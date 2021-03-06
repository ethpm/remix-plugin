/**
 * @module "ethpm/config"
 */

import * as t from 'io-ts/lib';
import { ThrowReporter } from 'io-ts/lib/ThrowReporter';

export type ConfigValue<S = any> =
  string | (() => Connector<S>) | ({ default: () => Connector<S> });

export type HasManifests = { manifests: any };
export type HasStorage = { storage: any };
export type HasRegistries = { registries: any };
export type Complete = HasManifests & HasStorage & HasRegistries;

import * as manifests from '../manifests/service';
import * as storage from '../storage/service';
import * as registries from '../registries/service';

/**
 * Polymorphic type alias for any object that exposes keys for any or all
 * available services, i.e. `manifests`, `registries`, `storage`
 */
export type Config =
    HasManifests | HasStorage | HasRegistries |
      HasManifests & HasStorage |
      HasManifests & HasRegistries |
      HasStorage & HasRegistries |
      HasManifests & HasStorage & HasRegistries;

export type RawConfig<T extends Config> = {
  [K in keyof T]: ConfigValue<Workspace<T>[K]>
} & { [k: string]: ConfigValue };

export abstract class Connector<S> {
  abstract optionsType: any;

  abstract async init (...args: any[]): Promise<S>;

  async connect (options: t.mixed): Promise<S> {
    const validation = this.optionsType.decode(options);
    if (!validation.isRight()) {
      ThrowReporter.report(validation);
    }

    return this.init(validation.value);
  }
}

export type Workspace<T extends Config> = {
  [K in keyof T]:
    K extends 'manifests' ? manifests.Service :
    K extends 'storage' ? storage.Service :
    K extends 'registries' ? registries.Service :
    never
};

export type Connectors<T extends Config> = {
  [K in keyof Workspace<T>]: Connector<Workspace<T>[K]>
} & { [k: string]: Connector<any> };
