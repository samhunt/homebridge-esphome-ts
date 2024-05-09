import { API, DynamicPlatformPlugin, Logging, PlatformAccessory, PlatformConfig } from 'homebridge';
import { concat, from, interval, Observable, of, Subscription } from 'rxjs';
import { catchError, filter, map, mergeMap, take, tap, timeout } from 'rxjs/operators';
import { componentHelpers } from './homebridgeAccessories/componentHelpers';
import { Accessory, PLATFORM_NAME, PLUGIN_NAME, UUIDGen } from './index';
// import { writeReadDataToLogFile } from './shared';
import { discoverDevices } from './discovery';
const { Client, Discovery } = require('@2colors/esphome-native-api');

interface IEsphomeDeviceConfig {
    host: string;
    port?: number;
    password?: string;
    encryptionKey?: string;
    retryAfter?: number;

    excludedTypes?: string[];
    excludedNames?: string[];
}

export interface IEsphomePlatformConfig extends PlatformConfig {
    devices?: IEsphomeDeviceConfig[];
    debug?: boolean;
    retryAfter?: number;
    discover?: boolean;
    discoveryTimeout?: number;
    coThreshold?: number;
    co2Threshold?: number;
}

const DEFAULT_RETRY_AFTER = 90_000;
const DEFAULT_DISCOVERY_TIMEOUT = 5_000; // milliseconds

export class EsphomePlatform implements DynamicPlatformPlugin {
    // protected readonly espDevices: EspDevice[] = [];
    protected readonly subscription: Subscription;
    protected readonly accessories: PlatformAccessory[] = [];

    constructor(
        protected readonly log: Logging,
        protected readonly config: IEsphomePlatformConfig,
        protected readonly api: API,
    ) {
        this.subscription = new Subscription();
        this.log('starting esphome');
        if (!Array.isArray(this.config.devices) && !this.config.discover) {
            this.log.error(
                'You did not specify a devices array and discovery is ' +
                    'disabled! Esphome will not provide any accessories',
            );
            this.config.devices = [];
        }

        this.api.on('didFinishLaunching', () => {
            this.onHomebridgeDidFinishLaunching();
        });
        // this.api.on('shutdown', () => {
        //     this.espDevices.forEach((device: EspDevice) => device.terminate());
        //     this.subscription.unsubscribe();
        // });
    }

    protected onHomebridgeDidFinishLaunching(): void {
        const devices: Observable<IEsphomeDeviceConfig> = from(this.config.devices ?? []);

        // simple discovery
        if (this.config.discover) {
            const discovery = new Discovery();
            discovery.on('info', (info: any) => {
                const deviceConfig = this.config.devices?.find(
                    ({ host }) => host === info.address || host === info.host,
                );

                if (deviceConfig === undefined) return;

                let match: boolean = false;
                if (deviceConfig.host !== info.address && deviceConfig.host !== info.host) {
                    return;
                }

                const device = new Client({
                    host: deviceConfig.host,
                    port: deviceConfig.port ?? 6053,
                    encryptionKey: deviceConfig.encryptionKey, // Use encryption key
                    password: deviceConfig.password, // Insert password if you have any (Deprecated)
                    clientInfo: 'homebridge-esphome-ts',
                    reconnect: deviceConfig.retryAfter,
                    reconnectInterval: this.config.retryAfter ?? DEFAULT_RETRY_AFTER,
                });

                device.connect();

                if (this.config.debug) {
                    this.log('Writing the raw data from your ESP Device to /tmp');
                    // TODO: Fix Debugging
                    // writeReadDataToLogFile(deviceConfig.host, device);
                }
                // get accessories and listen for state changes

                device.on('newEntity', (entity: any) => {
                    this.attachAccessory(entity, deviceConfig);
                });

                match = true;
                // TODO: log if we are unable to find a device

                this.log('Writing the raw data from your ESP Device to /tmp');
            });
            discovery.run();
        } else {
            this.config.devices?.forEach((deviceConfig) => {
                const device = new Client({
                    host: deviceConfig.host,
                    port: deviceConfig.port ?? 6053,
                    encryptionKey: deviceConfig.encryptionKey, // Use encryption key
                    password: deviceConfig.password, // Insert password if you have any (Deprecated)
                    clientInfo: 'homebridge-esphome-ts',
                    reconnect: deviceConfig.retryAfter,
                    reconnectInterval: this.config.retryAfter ?? DEFAULT_RETRY_AFTER,
                });

                device.connect();

                if (this.config.debug) {
                    this.log('Writing the raw data from your ESP Device to /tmp');
                    // TODO: Fix Debugging
                    // writeReadDataToLogFile(deviceConfig.host, device);
                }
                // get accessories and listen for state changes

                device.on('newEntity', (entity: any) => {
                    this.attachAccessory(entity, deviceConfig);
                });
            });
        }
    }

    private attachAccessory(component: any, deviceConfig: IEsphomeDeviceConfig): void {
        const componentHelper = componentHelpers.get(component.type);
        if (!componentHelper) {
            this.log(
                `${component.name} (${component.type}) is currently not supported. You might want to file an issue on Github.`,
            );
            return;
        }

        const uuid = UUIDGen.generate(component.name + component.config.key.toString());
        let newAccessory = false;

        let accessory: PlatformAccessory | undefined = this.accessories.find((accessory) => accessory.UUID === uuid);
        if (!accessory) {
            this.logIfDebug(`${component.name} must be a new accessory`);
            accessory = new Accessory(component.name, uuid);
            newAccessory = true;
        }

        var mappedComponent = componentHelper(component, accessory, this.config);

        var ignoreType = (deviceConfig.excludedTypes ?? []).indexOf(component.type) >= 0;
        var ignoreName = (deviceConfig.excludedNames ?? []).indexOf(component.name) >= 0;

        if (!mappedComponent || ignoreName || ignoreType) {
            let message = `${component.name}`;
            if(!mappedComponent){
                message += ` (${component.type}) could not be mapped to HomeKit. Please file an issue on Github.`;
            }else if(ignoreName){
                message += ` Name excluded.`;
            }else if (ignoreType){
                message += ` Type excluded (${component.type}).`;
            }
            
            if(!newAccessory){
                message += ` Unregistering existing accessory.`;
                this.api.unregisterPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory]);
            }
            this.log(message);

            return;
        }

        if(newAccessory)
        {
            this.log(`${component.name} discovered and setup.`);
        }else{
            return;
        }
        if (accessory) {
            this.log(`${component.name} added with UUID: ${accessory.UUID}`);
            this.accessories.push(accessory);
            this.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory]);
        }
    }

    public configureAccessory(accessory: PlatformAccessory): void {
        this.accessories.push(accessory);
        this.logIfDebug(`cached accessory ${accessory.displayName} was added`);
    }

    private logIfDebug(msg?: any, ...parameters: unknown[]): void {
        if (this.config.debug) {
            this.log(msg, parameters);
        } else {
            this.log.debug(msg, parameters);
        }
    }
}
