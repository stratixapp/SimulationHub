# SimulatorHub v49 - step transition redesigned (supersedes v48's animation)

- Loader = the supplied "DOT ECHOSYSTEM - Fade Reveal Loader" (green D, green O, orange T + ECHOSYSTEM), same CSS keyframes.
- No white screen: the loader sits on a light frosted/blurred layer; the NEXT step is rendered right away and fades/de-blurs in behind it, so the
  student sees the loader and the next page appearing at the same time. At the end the frosted layer + loader fade out.
- Length: 2 seconds for every step; 4 seconds when the step being opened is the final document review (the step before "Mark Complete").
  Review -> completion is a normal 2 s. Logistics Simulator only (not ICEGATE).
- Fixed while building: the base .step-fade-in rule used to restart when the inline reveal ended (a second flash); both are now cleared together.
Files: logistics-simulator/engine.js (skPlayStepWave), styles.css (.sk-zb). Test: tests/ui/step_transition.js (15 checks). Cache skelora-v104.
