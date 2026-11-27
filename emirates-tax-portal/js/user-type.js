/* ==========================================================================
   user-type.js — User Type Selection (real EmaraTax step, added after
   Login and before the Taxable Person list)
   Created By Ananthu Shaji
   ========================================================================== */

(function () {
  "use strict";

  const session = VATSIM.requireSession("../login.html");
  if (!session) return;
  const account = VATSIM.getAccount();
  if (!account) {
    window.location.href = "../index.html";
    return;
  }
  VATSIM.wireChrome();

  const MORE_TEXT = {
    taxable: "This is the standard registrant type used throughout this simulator — the account you registered for VAT with.",
    "legal-rep": "Represents someone who legally cannot manage their own tax affairs directly (e.g. a company manager, or a guardian). Not modeled in this training simulator — it only supports the direct Taxable Person flow.",
    "tax-agent": "A person registered with the FTA's Register of Tax Agents, authorized to file on behalf of clients. Not modeled here — see the note on the User Authorization page for more.",
    "tax-agency": "A licensed firm employing registered Tax Agents. Not modeled in this training simulator.",
  };

  document.querySelectorAll(".more").forEach((a) => {
    a.addEventListener("click", (e) => {
      e.preventDefault();
      VATSIM.toast(MORE_TEXT[a.getAttribute("data-more")], "info");
    });
  });

  document.getElementById("btnProceed").addEventListener("click", () => {
    const choice = document.querySelector('input[name="userType"]:checked').value;
    if (choice !== "taxable") {
      VATSIM.toast("This simulator only models the Taxable Person flow — continuing as Taxable Person.", "info");
    }
    window.location.href = "taxable-person.html";
  });
})();
