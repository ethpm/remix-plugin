/**
 * @module "ethpm/session"
 */

import * as config from '../config';

import * as pkg from '../package';
import * as manifests from '../manifests';
import * as storage from '../storage';
import * as registries from '../registries';

import { Query } from './query';

export class Builder<T extends config.Config> {
  private connectors: config.Connectors<T>;

  constructor (configInit: config.RawConfig<T>) {
    this.connectors = Object.assign(
      {}, ...Object.keys(configInit)
        .map((service) => ({
          [service]: config.load(configInit[service]),
        })),
    );
  }

  async connect (options: any = {}): Promise<Session<T>> {
    const workspace = Object.assign({}, ...await Promise.all(
      Object.keys(this.connectors).map( async (service) => ({
        [service]: await this.connectors[service].connect(options),
      })),
    ));

    return new Session(workspace);
  }
}

export class Session<T extends config.Config> {
  private workspace: config.Workspace<T>;

  constructor (workspace: config.Workspace<T>) {
    this.workspace = workspace;
  }

  query (packageInit: pkg.Package): Query<T> {
    return new Query({
      package: packageInit,
      workspace: this.workspace,
    });
  }

  get manifests(): config.Workspace<config.HasManifests>['manifests'] | never {
    if ('manifests' in this.workspace) {
      return (<config.Workspace<config.HasManifests>>this.workspace).manifests;
    }

    throw new Error('No manifests');
  }

  get storage(): config.Workspace<config.HasStorage>['storage'] | never {
    if ('storage' in this.workspace) {
      return (<config.Workspace<config.HasStorage>>this.workspace).storage;
    }

    throw new Error('No storage');
  }

  get registries(): config.Workspace<config.HasRegistries>['registries'] | never {
    if ('registries' in this.workspace) {
      return (<config.Workspace<config.HasRegistries>>this.workspace).registries;
    }

    throw new Error('No registries');
  }
}
