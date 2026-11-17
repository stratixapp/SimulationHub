# SimulatorHub v48 - 3-second Zoho-Books-style transition between steps (Logistics Simulator only)

Every time a student completes a step in a Logistics Simulator document (Save & Continue / Mark Complete) the old 1-second wave is replaced by:
0.0-0.4s the screen fades to a clean surface -> four coloured tiles (red / green / yellow / blue) assemble and turn like ledger pages, with
"Saving your work - Next: <step name>" and a 3-second colour progress bar -> at 1.5s the next step is prepared unseen behind it ->
2.25-3.0s the overlay fades out slowly and the next page is revealed. ~3 seconds in total; clicks are blocked meanwhile, a double click starts one
transition only, the step change always happens even if animation is off (reduced-motion users get a static mark, same timing).
Not used in ICEGATE. Original artwork inspired by Zoho's colour palette - no Zoho logo or asset is used.
Files: logistics-simulator/engine.js (skPlayStepWave), styles.css (.sk-zb). Test: tests/ui/step_transition.js. Cache skelora-v103.
