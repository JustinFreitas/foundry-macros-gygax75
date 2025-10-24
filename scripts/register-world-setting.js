game.settings.register("ose", "upkeepStartDate", {
  scope: "world",      // This specifies a world-level setting
  config: false,        // This specifies that the setting appears in the configuration view
  requiresReload: false, // This will prompt the GM to have all clients reload the application for the setting to take effect.
  default: '',         // The default value for the setting
  onChange: value => { // A callback function which triggers when the setting is changed
    console.log(value)
  }
});
