HUB PHOTOS - optional local overrides
=====================================
The simulator cards and the hero banners show free-licence Pexels photos when the device is online, and a built-in illustration when offline.

To use your OWN picture for a simulator, copy the file into this folder and list it in photos.json:

  {
    "logistics":    "my-port.jpg",
    "uaevat":       "dubai.webp",
    "tcos":         "container-yard.jpg"
  }

Keys: logistics, uaevat, tcos, gst, officeadmin, hrpayroll, procurement, fullerp, supplychain, tcos-cadence
Use wide landscape images (about 1600 x 900). Reload the hub (Ctrl+F5) after changing the files.
Leave photos.json as {} to keep the default photos.
