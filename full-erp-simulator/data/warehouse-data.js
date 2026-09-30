/* =============================================================================
   DOT ERP
   FILE:  data/warehouse-data.js
   ROLE:  Data-access layer for Warehouses — Phase 2, Module 09.

   FLAT, LIKE COST CENTERS — NOT A TREE, LIKE DEPARTMENTS:
   Same reasoning as Cost Centers (Module 08): real warehouse networks are a
   flat list of physical sites, not a parent/child org structure. A
   warehouse can optionally link to a Branch (the site it physically sits
   at) via `branchId` — the same "store the id, look it up live" pattern
   Cost Centers used for its Department/Branch links.

   ADDRESS: A THIRD PATTERN, BUILT ON TOP OF THE OTHER TWO —
   Currency/GST Details sync a single discriminating VALUE (demote-then-
   replace). Branches' Head Office syncs a descriptive address IN PLACE
   (same record, always up to date). Warehouses need something different
   again: MOST warehouses genuinely share their linked branch's address —
   that's the default, resolved live via getEffectiveAddress() rather than
   copied, so it can never drift out of sync. But a real warehouse network
   sometimes has its own site address that legitimately differs from its
   administrative branch (a third-party logistics site, a bonded warehouse
   under separate customs registration, a cold-storage facility leased at a
   different location) — that's why `useCustomAddress` exists as an
   explicit, deliberate opt-out per warehouse, not a default. A warehouse
   with no linked branch at all has no address to inherit, so it always
   behaves as if `useCustomAddress` were true.

   CAPACITY UTILIZATION REUSES COST CENTERS' VARIANCE PATTERN —
   getCapacityUsage()/getUtilizationBand() mirror getVariance()/
   getUtilizationBand() from cost-center-data.js almost exactly (the same
   under/near/over three-way band, the same divide-by-zero guard), because
   "how full is this container relative to its limit" is the same shape of
   problem whether the container is a budget or a warehouse. IMPORTANT:
   unlike Cost Centers' budgets (always the company's base currency, so
   summable), each warehouse picks its own `capacityUnit` (Sq. Ft., Pallet
   Positions, Cubic Meters, ...) — a company-wide SUM of totalCapacity
   would silently add incompatible units together. The page-level summary
   deliberately reports an AVERAGE utilization % instead of a total
   capacity figure, since a percentage is the only unit-agnostic thing that
   can honestly be aggregated across a mixed-unit warehouse fleet.

   ZONES: DELIBERATELY LIGHTWEIGHT —
   Each warehouse can carry a small list of named storage zones (Receiving,
   Storage, Picking, Packing, Dispatch, Quarantine, Returns) — enough to
   teach that a warehouse isn't one undifferentiated box, without building
   real bin-level stock transactions, which is explicitly Phase 6's job
   (Inventory > Bin Location). A zone here is just {id, zoneName, zoneType};
   it carries no quantity, capacity, or stock of its own.
   ========================================================================== */

const ERP_WAREHOUSES_KEY = "erp_warehouses";

const ERP_WAREHOUSE_TYPES = [
  "Central Warehouse", "Regional Warehouse", "Distribution Center",
  "Raw Material Store", "Finished Goods Store", "Cold Storage", "Bonded Warehouse"
];

const ERP_WAREHOUSE_ZONE_TYPES = [
  "Receiving", "Storage", "Picking", "Packing", "Dispatch", "Quarantine", "Returns"
];

const ERP_WAREHOUSE_CAPACITY_UNITS = [
  "Sq. Ft.", "Sq. M.", "Pallet Positions", "Cubic Meters", "Metric Tons"
];


const ERP_WarehouseRepository = {
  warehouseTypes: ERP_WAREHOUSE_TYPES,
  zoneTypes: ERP_WAREHOUSE_ZONE_TYPES,
  capacityUnits: ERP_WAREHOUSE_CAPACITY_UNITS,

  getAll() {
    try { return JSON.parse(localStorage.getItem(ERP_WAREHOUSES_KEY)) || []; }
    catch { return []; }
  },
  _saveAll(list) {
    try { localStorage.setItem(ERP_WAREHOUSES_KEY, JSON.stringify(list)); return true; }
    catch { return false; }
  },

  getAllForCompany(companyId) {
    return this.getAll()
      .filter((w) => w.companyId === companyId)
      .sort((a, b) => a.warehouseName.localeCompare(b.warehouseName));
  },

  findById(id) {
    return this.getAll().find((w) => w.id === id) || null;
  },

  /** COMP-001-WH-01, COMP-001-WH-02, ... — same per-company, never-reused
      numbering convention every other Phase 2 module already established. */
  nextWarehouseCode(company) {
    const mine = this.getAllForCompany(company.id);
    let max = 0;
    mine.forEach((w) => {
      const match = /-WH-(\d+)$/.exec(w.warehouseCode || "");
      if (match) max = Math.max(max, parseInt(match[1], 10));
    });
    return `${company.companyCode}-WH-${String(max + 1).padStart(2, "0")}`;
  },

  /** Resolves the address this warehouse should actually show: its own
      fields if it opted into a custom address (or has no branch linked at
      all), otherwise looked up LIVE from the linked branch every time —
      never copied, so it can't drift. See file header for the full
      reasoning. `source` tells the caller which case applied, mainly so
      the UI can label it ("Shared with <branch>" vs "Custom address"). */
  getEffectiveAddress(warehouse) {
    const ownFields = {
      address1: warehouse.address1 || "", address2: warehouse.address2 || "",
      city: warehouse.city || "", state: warehouse.state || "", pincode: warehouse.pincode || ""
    };
    if (!warehouse.branchId || warehouse.useCustomAddress) {
      return { ...ownFields, source: "custom" };
    }
    const branch = ERP_BranchRepository.findById(warehouse.branchId);
    if (!branch) return { ...ownFields, source: "custom" }; // linked branch missing/removed — fall back
    return {
      address1: branch.address1 || "", address2: branch.address2 || "",
      city: branch.city || "", state: branch.state || "", pincode: branch.pincode || "",
      source: "branch"
    };
  },

  /** RETROFIT (Phase 3, Module 1): resolves the display name for this
      warehouse's manager. Prefers the live-looked-up Employee Master
      record if `managerEmployeeId` is linked — appending the employee's
      status when it isn't Active, so an outdated assignment doesn't read
      as though nothing's changed. Falls back to the free-text
      `managerName` field for anyone genuinely not in Employee Master yet.
      Exact same shape as Cost Centers' getResponsiblePersonLabel() —
      see that file's comment for the full reasoning. */
  getManagerLabel(warehouse) {
    if (warehouse.managerEmployeeId && typeof ERP_EmployeeRepository !== "undefined") {
      const emp = ERP_EmployeeRepository.findById(warehouse.managerEmployeeId);
      if (emp) return emp.status !== "Active" ? `${emp.fullName} (${emp.status})` : emp.fullName;
    }
    return warehouse.managerName || "—";
  },

  /** Capacity vs. utilized — the gap (free space) and utilization %, same
      shape as Cost Centers' getVariance(). Guards a zero capacity instead
      of dividing by it. */
  getCapacityUsage(warehouse) {
    const capacity = Number(warehouse.totalCapacity) || 0;
    const used = Number(warehouse.utilizedCapacity) || 0;
    const free = capacity - used;
    const utilizationPct = capacity > 0 ? (used / capacity) * 100 : (used > 0 ? Infinity : 0);
    return { capacity, used, free, utilizationPct };
  },

  /** Same under/near/over three-way band as Cost Centers' getUtilizationBand:
      "under" (comfortable headroom), "near" (80-100%), "over" (100%+, i.e.
      overstocked beyond the warehouse's stated capacity). */
  getUtilizationBand(warehouse) {
    const { utilizationPct } = this.getCapacityUsage(warehouse);
    if (utilizationPct > 100) return "over";
    if (utilizationPct >= 80) return "near";
    return "under";
  },

  create(company, data) {
    const record = {
      id: "WH-" + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 5).toUpperCase(),
      companyId: company.id,
      warehouseCode: this.nextWarehouseCode(company),
      status: "Active",
      branchId: null,
      useCustomAddress: false,
      address1: "", address2: "", city: "", state: "", pincode: "",
      managerName: "",
      managerEmployeeId: null,
      contactPhone: "",
      capacityUnit: ERP_WAREHOUSE_CAPACITY_UNITS[0],
      totalCapacity: 0,
      utilizedCapacity: 0,
      zones: [],
      description: "",
      createdAt: new Date().toISOString(),
      ...data
    };
    const all = this.getAll();
    all.push(record);
    this._saveAll(all);
    return record;
  },

  update(id, partial) {
    const all = this.getAll();
    const idx = all.findIndex((w) => w.id === id);
    if (idx === -1) return null;
    all[idx] = { ...all[idx], ...partial, updatedAt: new Date().toISOString() };
    this._saveAll(all);
    return all[idx];
  },

  /** Active <-> Inactive. No protected "primary" record like Branches' Head
      Office — every warehouse here is equally deletable/deactivatable. */
  toggleStatus(id) {
    const wh = this.findById(id);
    if (!wh) return null;
    return this.update(id, { status: wh.status === "Active" ? "Inactive" : "Active" });
  },

  /** No dependency protection needed yet — nothing else in Phase 2/3
      references a warehouse by id. Phase 6 (Inventory) is exactly where
      that will start to matter, the same situation Cost Centers is in. */
  remove(id) {
    const all = this.getAll().filter((w) => w.id !== id);
    this._saveAll(all);
    return true;
  },

  hasDuplicateName(companyId, warehouseName, excludeId) {
    const target = warehouseName.trim().toLowerCase();
    return this.getAllForCompany(companyId).some((w) => w.id !== excludeId && w.warehouseName.trim().toLowerCase() === target);
  }
};
