#!/usr/bin/env python3
"""
Rebuild supplychain-tcos/ (the TCOS copy bundled with the Cadence Supply Chain suite) from tcos/.

Run from the hub folder:   py tools/sync-supplychain-tcos.py        (or:  python3 tools/sync-supplychain-tcos.py)

supplychain-tcos is meant to be the SAME program as tcos. Only these things differ, and this script re-applies them after copying:
  1. js/state.js   SESSION_KEY and STORAGE_PREFIX are namespaced ("..._supplychain_v1"), so a student's progress and login in the
                   Supply Chain suite never overwrite (or get overwritten by) the hub's main TCOS.
  2. js/app.js     REGISTERED_USERS_KEY is namespaced the same way.
  3. js/app.js     the message handler also understands 'igCadence' (the "Cadence" quick link on the home page).
  4. intro.html    one extra quick link on the home page: Cadence Demand Planning Workbench (../cadence-supply-chain/index.html).
The script stops with an error if any of the lines it needs to change cannot be found, so a changed tcos/ can never be copied half-way.
"""
import os, re, shutil, sys

HUB = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC, DST = os.path.join(HUB, 'tcos'), os.path.join(HUB, 'supplychain-tcos')

def read(p):
    with open(p, encoding='utf-8') as f: return f.read()
def write(p, s):
    with open(p, 'w', encoding='utf-8', newline='') as f: f.write(s)
def swap(path, old, new, label):
    s = read(path)
    if old not in s:
        sys.exit('STOP: could not find %s in %s - tcos/ changed; update tools/sync-supplychain-tcos.py' % (label, path))
    write(path, s.replace(old, new, 1))

if not os.path.isdir(SRC): sys.exit('tcos/ folder not found next to tools/')
tmp = DST + '.new'
if os.path.isdir(tmp): shutil.rmtree(tmp)
shutil.copytree(SRC, tmp)

state, app, intro = (os.path.join(tmp, p) for p in ('js/state.js', 'js/app.js', 'intro.html'))
swap(state, "const SESSION_KEY = 'icegate_training_session_v1';",
     "const SESSION_KEY = 'icegate_training_session_supplychain_v1'; // namespaced - this is the Supply Chain suite's paired copy of TCOS, kept separate from the hub's main TCOS so progress and sessions in one never touch the other", 'SESSION_KEY')
swap(state, "const STORAGE_PREFIX = 'icegate_training_state_v1::';",
     "const STORAGE_PREFIX = 'icegate_training_state_supplychain_v1::'; // namespaced - without this a student's saved progress here would silently overwrite (or be overwritten by) their progress in the hub", 'STORAGE_PREFIX')
swap(app, "const REGISTERED_USERS_KEY = 'icegate_training_registered_users_v1';",
     "const REGISTERED_USERS_KEY = 'icegate_training_registered_users_supplychain_v1'; // namespaced - keeps this suite's registered logins separate from the main TCOS", 'REGISTERED_USERS_KEY')
swap(app, "if (ev && ev.data && ev.data.type === 'igSuite')",
     "if (ev && ev.data && ev.data.type === 'igCadence') window.location.href = '../cadence-supply-chain/index.html'; if (ev && ev.data && ev.data.type === 'igSuite')", "the igSuite message handler")
swap(intro, ' <a class="quick" href="#" onclick="toSuite();return false">',
     ' <a class="quick" href="#" onclick="toCadence();return false"><span class="qicon">&#9638;</span><span><b>Cadence</b><span>Demand Planning Workbench</span></span></a>\n <a class="quick" href="#" onclick="toSuite();return false">', 'the Skelora Suite quick link')
swap(intro, "function toSuite(){",
     "function toCadence(){try{if(window.parent&&window.parent!==window){window.parent.postMessage({type:'igCadence'},'*');return}}catch(e){}location.href='../cadence-supply-chain/index.html'}\nfunction toSuite(){", 'toSuite()')

if os.path.isdir(DST): shutil.rmtree(DST)
os.rename(tmp, DST)
print('supplychain-tcos rebuilt from tcos (%d files)' % sum(len(f) for _, _, f in os.walk(DST)))
