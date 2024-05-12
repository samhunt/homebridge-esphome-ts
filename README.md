# homebridge-esphome-ts

#### This library adds Encryption, additional entity support, and stability to the original library [homebridge-esphome-ts](https://github.com/lucavb/homebridge-esphome-ts) by @lucavb
This was achieved, by substiting [esphome-native-api](https://github.com/twocolors/esphome-native-api/) for [esphome-ts](https://github.com/lucavb/esphome-ts)

This plugin integrates the [esphome](https://esphome.io/) platform into homebridge so that you don't have to go
through homeassistant if you don't want to (not that there is anything wrong with that). It makes use of the native API of esphome
so that you can expect instant updates for all your binary sensors what have you.

Supported components include:

-   Lights
-   Switches
-   BinarySensors (motion, window, door, smoke and leakage)
-   Sensors (temperature & humidity at the moment)
-   TextSensors (limited support using Diagnostic HomeKit Sensor type)

This project is currently still in beta, but I thought that many eyes see more than just
my two :)

## Installation

Unless you haven't done so already, make sure to install homebridge first. See instructions
[here](https://github.com/homebridge/homebridge/wiki). Once you have done this, you can install this plugin by typing

```
npm i -g homebridge-esphome-ts
```

Once this is done, you can configure your homebridge config.json according to the next section.

## Getting Started

```json
{
    "platform": "esphome",
    "devices": [
        {
            "host": "my_esp.local",
            "password": "Passw0rd!",
            "port": 9001,
            "retryAfter": 120000 // optional, time in milliseconds!
        }
    ],
    "retryAfter": 60000 // optional, time in milliseconds!
}
```

Only the `host` key is mandatory under devices. As password `''` is assumed aka no password and the default
port number 6053 is also wired into the plugin. You can add, in theory, as many ESP devices as you want to
that array.

If some of your devices are password-less you can enable devices discovery to let the plugin find all your
devices by setting `discover: true` in platform configuration. In case if you don't have any password-secured
devices you can even fully omit `"devices"` section in platform configuration.

In case you don't have a working esphome configuration you can have look at the examples folder. There you will
find both an example homebridge `config.json` file as well as an example esphome configuration. For further guidance
on esphome please check out their website.

### retryAfter

Both `retryAfter` keys are as explained optional and need to contain an integer that tells this plugin
after what time frame it should try to reconnect. Keep in mind that this value needs to be in _milliseconds_. The inner
`retryAfter` will trump the outer value if present. The default value is 90 seconds.

### co2Threshold & coThreshold

When a CO2 and/or CO level is implemented in ESPHome, these thresholds are responsible to raise an alert in the Home application, via a notification and a message in the app. This is used to prevent intoxication.

> Reminder:
> CO is the Carbon Monoxide
> CO2 is the carbon Dioxide

### Blacklisting

If for some reason you want to exclude a specific component from this plugin just
add a key containing its name (as it was defined in esphome and is shown initially in HomeKit) to a string array under the key `blacklist`:

```json
{
    "platform": "esphome",
    "devices": [
        ...
    ],
    "blacklist": [
        "My blacklisted switch"
    ]
}
```

## Todo

-   [x] Implement a blacklist for components
-   [ ] Testing, especially with the new homebridge version
-   [x] Implement sensor component

## Troubleshooting

Please make sure to add the `api` entry to your config!

If you still have problems please feel free to open a ticket on GitHub. Before doing so add this to your
config `"debug": true`. The plugin will now output what it has gotten from your ESP device.
Please append this when you open a ticket here on GitHub. Please attach your config as well and make
sure to remove any sensitive information such as WiFi passwords.

In addition to simply writing stuff to the console, it will also write everything received from your devices to individual
files under `/tmp`. You can then submit these files with any issues you might file on GitHub.

_Slight warning_ The writing of these files means that it will also occupy more space on your SD card or whatever you
might have. So simply turn off this option once you don't need it anymore.
