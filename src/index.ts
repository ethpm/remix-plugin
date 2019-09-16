import { LitElement, html, customElement } from 'lit-element';
import { createIframeClient } from '@remixproject/plugin';
import { saveAs } from 'file-saver';
import fs from 'fs';

import { EthPM } from './ethpm';
import { getBlockchainFromUri } from './utils/chains';
import {
  CompilationFileSources,
  CompilationResult,
  Status,
} from './utils';

const _ = require('lodash');
const path = require('path');
const AJV = require('ajv');
const schema = require('./ethpm/manifests/v2/schema.json');

type contractTypeData = {
  abi: any[];
  compiler: any;
  contractName: string;
  deploymentBytecode: any;
  runtimeBytecode: any;
  natspec: any;
};

type ContractTypeMap = {
  [contractType: string]: contractTypeData;
};

type SourcesMap = {
  [contractType: string]: string;
};

type manifest = {
  manifest: object;
  ipfsUri: URL;
};

type manifestMap = {
  [name: string]: manifest;
};

@customElement('ethpm-dapp')
export class EthpmDapp extends LitElement {
  /** client to communicate with the IDE */
  private client = createIframeClient();
  private contractTypes: ContractTypeMap = {};
  private sources: SourcesMap = {};
  private contractAlerts: any = {};
  private manifests: manifestMap = {};
  private importedDeployments: any = {};
  private importedSources: any = {};
  private importedManifest: any = {};
  private creatingPackages: boolean = true;
  private ethpm: any;

  constructor() {
    super();
    this.init();
  }

  async init() {
        this.ethpm = await EthPM.configure({
                manifests: 'ethpm/manifests/v2',
                storage: 'ethpm/storage/ipfs',
          }).connect({
                ipfs: {
                  host: 'ipfs.infura.io',
                  port: '5001',
                  protocol: 'https',
                },
          });

    await this.client.onload();
    this.client.solidity.on(
      'compilationFinished',
      (
        file: string,
        src: CompilationFileSources,
        version: string,
        result: CompilationResult,
      ) => {
        if (!result) return;
        this.contractTypes = this.createContractTypes(result);
                this.sources = this.createManifestSources(src);
        const status: Status = {
          key: 'succeed',
          type: 'success',
          title: 'New interface generated',
        };
        this.client.emit('statusChanged', status);
        this.requestUpdate();
      },
    );
  }

  /** ⚠️ If you're using LitElement you should disable Shadow Root ⚠️ */
  createRenderRoot() {
    return this;
  }

  processBytecode(bytecode: any) {
        const bcObject = {};
        let newBytecode = `0x${bytecode.object}`;
        if (!_.isEmpty(bytecode.linkReferences)) {
          const allOffsets = [];
          // generate manifest link refs object
          const linkRefs = Object.keys(bytecode.linkReferences).map(key => {
                return Object.keys(bytecode.linkReferences[key]).map(cType => {
                  const ctypeOffsets = bytecode.linkReferences[key][cType].map(a => a.start);
                  allOffsets.push(ctypeOffsets);
                  return {
                        name: cType,
                        length: 20,
                        offsets: ctypeOffsets,
                  };
                });
          });
          // replace solc link ref "___browser/contract.sol___" with 0s
          const numLinkRefs = linkRefs.length;
          for (let i = 0; i < numLinkRefs; i++) {
                const start = 2 + allOffsets[i] * 2;
                const tmpBytecode = `
					${newBytecode.substr(0, start)}
					${'0'.repeat(40)}
					${newBytecode.substr(start + 40, newBytecode.length)}
				`;
                newBytecode = tmpBytecode;
          }
          bcObject['link_references'] = [].concat.apply([], linkRefs);
        }
        bcObject['bytecode'] = newBytecode;
        return bcObject;
  }

  // support vyper compiler
  // is contract name right / support aliasing
  // validate all contract types have sources
  // validate uris are schemed correctly
  // improve loading screen
  // import/export gist
  // deployments
  createContractTypes(result: CompilationResult) {
    return Object.keys(result.contracts).reduce((acc, fileName) => {
      const contracts = result.contracts[fileName];
      Object.keys(contracts).forEach(
                name => (acc[name] = {
                  abi: contracts[name].abi,
                  contractName: name,
                  compiler: {
                        name: 'solc',
                        version: JSON.parse(contracts[name].metadata)['compiler']['version'],
                        settings: {
                          optimize: JSON.parse(contracts[name].metadata)['settings']['optimizer']['enabled'],
                        },
                  },
                  runtimeBytecode: this.processBytecode(contracts[name].evm.bytecode),
                  deploymentBytecode: this.processBytecode(contracts[name].evm.deployedBytecode),
                  natspec: _.merge(contracts[name].userdoc, contracts[name].devdoc),
                }),
      );
      return acc;
    },                                          {});
  }

  createManifestSources(src: CompilationFileSources) {
    return Object.keys(src.sources).reduce((acc, fileName) => {
          acc[`./${fileName}`] = src.sources[fileName].content;
      return acc;
    },                                     {});
  }

  changeView() {
        if (this.creatingPackages) {
          document.getElementById('creatingPackages').style.display = 'none';
          document.getElementById('importingPackages').style.display = 'block';
          this.creatingPackages = false;
        } else {
          document.getElementById('creatingPackages').style.display = 'block';
          document.getElementById('importingPackages').style.display = 'none';
          this.creatingPackages = true;
        }
        this.requestUpdate();
  }

  downloadRawManifest(name) {
        const fileName = `${name}.json`;
        const fileToSave = new Blob([JSON.stringify(this.manifests[name].manifest)], {
                type: 'application/json',
        });
        saveAs(fileToSave, fileName);
  }

  getManifestElementData(elementId, csv= false) {
        const result = (<HTMLInputElement>(
          document.getElementById(elementId)
        )).value;
        if (result === '') {
          return null;
        } else if (csv) {
          return result.split(',');
        } else {
          return result;
        }
  }

  async generateManifest() {
    try {
      const packageName = (<HTMLInputElement>document.getElementById('packageName'))
        .value;
          if (!/^[a-z][-a-z0-9]{0,255}$/.test(packageName)) {
                throw new Error('Please enter a valid name for your package. Package names must match regex: ^[a-z][-a-z0-9]{0,255}$.');
          }

      const packageVersion = (<HTMLInputElement>(
        document.getElementById('packageVersion')
      )).value;
          if (!packageVersion) {
                throw new Error('Please enter a package version.');
          }

          const rawLinks = {
                documentation: this.getManifestElementData('documentationLink'),
                repository: this.getManifestElementData('repositoryLink'),
                website: this.getManifestElementData('websiteLink'),
          };
          const filteredLinks = _.omitBy(rawLinks, _.isNull);
          const rawMeta = {
                authors: this.getManifestElementData('authors', true),
                license: this.getManifestElementData('license'),
                description: this.getManifestElementData('description'),
                keywords: this.getManifestElementData('keywords', true),
                links: (_.isEmpty(filteredLinks)) ? null : filteredLinks,
          };
          const filteredMeta = _.omitBy(rawMeta, _.isNull);

      const selectedContractTypes = [].slice
        .call(document.querySelectorAll('input[type=checkbox]:checked'))
        .map(checked => {
          return (<HTMLInputElement>checked).value;
        });

          const targetContract = selectedContractTypes[0];
          const targetContractType = this.contractTypes[targetContract];
          const contractTypeData = selectedContractTypes.reduce(
            (o, key) => ({ ...o, [key]: this.contractTypes[key]}),
            {});
          const rawManifest = {
                packageName,
                manifestVersion: '2',
                version: packageVersion,
                meta: (_.isEmpty(filteredMeta)) ? null : filteredMeta,
                sources: this.sources,
                contractTypes: contractTypeData,
          };

          const filteredManifest = _.omitBy(rawManifest, _.isNull);
          this.showAlert(undefined, 'Manifest created and pushing to IPFS, this could take a minute.');

          // Manifest json schema validation
          const createdManifest = await this.ethpm.manifests.write(filteredManifest);
          const ajv = new AJV();
          const valid = ajv.validate(schema, JSON.parse(createdManifest));
          if (!valid) throw new Error(`Invalid manifest generated. ${ajv.errorsText()}`);
          const manifestUri = await this.ethpm.storage.write(createdManifest);

      this.client.emit('statusChanged', {
        key: 'loading',
        type: 'info',
        title: 'Generating ...',
      });
          this.manifests[packageName] = {
                  manifest: createdManifest,
                  ipfsUri: manifestUri,
          };
          this.showAlert(undefined, 'Nice package! Use the ethPM-CLI to publish it to your registry!');
          setTimeout(() => {
                this.client.emit('statusChanged', { key: 'none' });
          },         10000);
        } catch (err) {
          console.log(err);
          this.showAlert(err, undefined);
        }
  }

  async processFilePath(fileName) {
        const baseName = path.basename(fileName);
        const file = baseName.split('.')[0];
        const extension = baseName.split('.')[1];
        let browserPath = `browser/${baseName}`;
        let exists = await this.client.fileManager.getFile(browserPath);
        let i = 1;
        if (exists != null) {
          do {
                const pathSegments = baseName.split('.');
                browserPath = `browser/${pathSegments[0]}-${i}.${extension}`;
                exists = await this.client.fileManager.getFile(browserPath);
                i ++;
          }
          while (exists != null);
        }
        return browserPath;
  }

  async processImportedSources(sources: any) {
        return Object.keys(sources).reduce((acc, fileName) => {
      Object.keys(sources).forEach(
                async name => (acc[fileName] = {
                  orignalPath: fileName,
                  newPath: await this.processFilePath(fileName),
                  content: sources[fileName],
                }),
      );
      return acc;
    },                                     {});
  }

  async importSource(name) {
        await this.client.call(
          'fileManager',
          'setFile',
          this.importedSources[name].newPath,
          this.importedSources[name].content,
        );
        delete this.importedSources[name];
        this.requestUpdate();
  }

  async importManifest() {
        try {
          const url = this.getManifestElementData('importUrl');
          this.showAlert(undefined, `Importing manifest from ${url}.`);
          const rawManifest = await this.ethpm.storage.read(url);
          const manifest = await this.ethpm.manifests.read(rawManifest);
          const sources = await this.processImportedSources(manifest.sources);
      this.client.emit('statusChanged', {
        key: 'loading',
        type: 'info',
        title: 'Loading manifests ...',
      });
          this.importedSources = sources;
          this.importedManifest = manifest;
          const obj = Array.from(manifest.deployments).reduce((obj, [key, value]) => (
                Object.assign(obj, { [key]: value })
          ),                                                  {});
          this.importedDeployments = obj;
        } catch (err) {
          console.log(err);
          this.showAlert(err, undefined);
        }
  }

  async importDeployment(name, alias) {
        const abi = JSON.stringify(this.importedManifest.contractTypes[name].abi);
        const importDeploymentFilename = await this.processFilePath(`./${name}.abi`);
        await this.client.call('fileManager', 'setFile', importDeploymentFilename, abi);
  }

  showAlert(err?: string, message?: string) {
    if (message) {
      this.contractAlerts = { message, type: 'success' };
    } else {
      const message = `${err}`;
      this.contractAlerts = { message, type: 'warning' };
    }
    this.requestUpdate();
    setTimeout(() => {
      this.contractAlerts = {};
      this.requestUpdate();
    },         5000);
  }

  render() {
    const isContracts = Object.keys(this.contractTypes).length > 0;
    const isImportedSources = Object.keys(this.importedSources).length > 0;
    const isImportedDeployments = Object.keys(this.importedDeployments).length > 0;

    const sourcesHeader = isImportedSources ? html`<h2><b>Sources</b></h2>` : html``;
    const deploymentsHeader = isImportedDeployments ? html`<h2><b>Deployments</b></h2>` : html``;

    const availableContracts = isContracts
      ? Object.keys(this.contractTypes).map((name, index) => {
          return html`
            <div class="form-check">
              <input
                class="form-check-input"
                type="checkbox"
                value="${name}"
                id="${index}"
                checked
              />
              <label>
                ${name}
              </label>
            </div>
          `;
        })
      : html`
          <div class="list-group-item">
            None found, please compile a contract using the Solidity Compiler
            tab <img src="./compiler.png" width="30" />
          </div>
        `;

    const form = html`
      <div>
        <div class="form-group">
          <label for="dappContracts">Available Contract Types:</label> ${
            availableContracts
          }
        </div>
        <div class="form-group">
                  <label for="packageName"><b>Package Name:</b> (required) </label>
          <input
            type="text"
            class="form-control"
            id="packageName"
            ?disabled="${!isContracts}"
          />
        </div>
        <div class="form-group">
                  <label for="packageVersion"><b>Package Version:</b> (required) </label>
          <input
            type="text"
            class="form-control"
            id="packageVersion"
            ?disabled="${!isContracts}"
          />
        </div>
                <div class="form-group">
                  <label for="authors"><b>Authors:</b> (optional) (comma separated for multiple values)</label>
                  <input
                        type="text"
                        class="form-control"
                        id="authors"
            ?disabled="${!isContracts}"
                  />
                </div>
                <div class="form-group">
                  <label for="license"><b>License:</b> (optional)</label>
                  <input
                        type="text"
                        class="form-control"
                        id="license"
            ?disabled="${!isContracts}"
                  />
                </div>
                <div class="form-group">
                  <label for="description"><b>Description:</b> (optional)</label>
                  <input
                        type="text"
                        class="form-control"
                        id="description"
            ?disabled="${!isContracts}"
                  />
                </div>
                <div class="form-group">
                  <label for="keywords"><b>Keywords:</b> (optional) (comma separated for multiple values)</label>
                  <input
                        type="text"
                        class="form-control"
                        id="keywords"
            ?disabled="${!isContracts}"
                  />
                </div>
                <div class="form-group">
                  <label for="documentationLink"><b>Link to documentation:</b> (optional)</label>
                  <input
                        type="text"
                        class="form-control"
                        id="documentationLink"
            ?disabled="${!isContracts}"
                  />
                </div>
                <div class="form-group">
                  <label for="repositoryLink"><b>Link to repository:</b> (optional)</label>
                  <input
                        type="text"
                        class="form-control"
                        id="repositoryLink"
            ?disabled="${!isContracts}"
                  />
                </div>
                <div class="form-group">
                  <label for="websiteLink"><b>Link to website:</b> (optional)</label>
                  <input
                        type="text"
                        class="form-control"
                        id="websiteLink"
            ?disabled="${!isContracts}"
                  />
                </div>
                <button
          type="submit"
          style="margin:10px 0 3px 0"
          class="btn btn-lg btn-primary mb-2"
          @click="${() => this.generateManifest()}"
          ?disabled="${!isContracts}"
        >
          Generate Manifest
        </button>
      </div>
    `;

    const contractAlerts = html`
      <div
        class="alert alert-${this.contractAlerts.type}"
        role="alert"
        ?hidden="${Object.keys(this.contractAlerts).length === 0}"
      >
        <img style="margin: 0 0 0 0" src="./chelsea.png" width="50" /> ${
          this.contractAlerts.message
        }
      </div>
    `;

        const importManifests = html`
          <div>
                <div class="form-group">
                  <br>
                  <p>
                        This plugin currently supports importing packages only from IPFS urls.
                        You can find a variety of available registries and their packages in the <a href="https://docs.ethpm.com/public-registry-directory" target="_blank">ethPM Registry Directory</a>.
                  </p>
                  <label for="importUrl"><b>IPFS URL:</b></label>
                  <input
                        type="text"
                        class="form-control"
                        id="importUrl"
                  />
                </div>
                <button
          type="submit"
          style="margin:10px 0 3px 0"
          class="btn btn-lg btn-primary mb-2"
          @click="${() => this.importManifest()}"
        >
          Import Manifest
        </button>
          </div>
        `;

        const importedSourcesList = Object.keys(this.importedSources).map((name, index) => {
      return html`
        <div class="card" style="margin-top:7px">
          <div class="card-body" style="padding: 7px">
                        <h5 class="card-title"><b>Source:</b> <code>${name}</code></h5>
                        <h5 class="card-title"><b>Import to:</b> <code>${this.importedSources[name].newPath}</code></h5>
                        <button
                          type="submit"
                          style="margin:10px 0 3px 0;float:right;margin-top:-60px;"
                          class="btn btn-lg btn-primary mb-2"
                          @click="${() => this.importSource(name)}"
                          >Import</a
            >
          </div>
        </div>
      `;
    });

        const importedDeploymentsList = Object.keys(this.importedDeployments).map((name, index) => {
          const deploymentsList =  Object.keys(this.importedDeployments[name]).map((alias, i) => {
                const address = this.importedDeployments[name][alias].address;
                const contractType = this.importedDeployments[name][alias].contractType;
                return html`
                  <div class="card" style="margin-top:7px">
                        <div class="card-body" style="padding: 7px">
                          <h3 class="card-title">${alias}</h3>
                          <p><b>Address:</b> ${address}</p>
                          <p><b>Contract Type:</b> ${contractType}</p>
                          <button
                                type="submit"
                                style="margin:10px 0 3px 0; float:right; margin-top:-80px;"
                                class="btn btn-lg btn-primary mb-2"
                                @click="${() => this.importDeployment(contractType, alias)}"
                                >Import ABI</a
                          >
                        </div>
                  </div>
                `;
          });
          return html`<h3><b>${getBlockchainFromUri(name)}</b></h3>${deploymentsList}`;
    });

    const manifests = Object.keys(this.manifests).map((name, index) => {
      return html`
        <div class="card" style="margin-top:7px">
          <div class="card-body" style="padding: 7px">
            <h5 class="card-title">${name}</h5>
            <h6 class="card-subtitle mb-2 text-muted">
                          <p>${this.manifests[name].ipfsUri.href}</p>
            </h6>
            <a
                          href="http://explorer.ethpm.com/manifest/${this.manifests[name].ipfsUri.pathname.substring(2)}"
                          style="margin:10px 0 3px 0"
              class="btn btn-sm btn-primary mb-2"
              target="_blank"
              >Manifest Preview</a
            >
                        <button
                          type="submit"
                          style="margin:10px 0 3px 0"
                          class="btn btn-sm btn-primary mb-2"
                          @click="${() => this.downloadRawManifest(name)}"
                        >
                          Download Raw Manifest
                        </button>
          </div>
        </div>
      `;
    });

    return html`
      <style>
        main {
          padding: 10px;
        }
        #alerts {
          margin-top: 20px;
          font-size: 0.8rem;
        }
        .alert {
          animation: enter 0.5s cubic-bezier(0.075, 0.82, 0.165, 1);
        }

        @keyframes enter {
          0% {
            opacity: 0;
            transform: translateY(50px) scaleY(1.2);
          }
          100% {
            opacity: 1;
            transform: translateY(0) scaleY(1);
          }
        }
      </style>
      <main>
                <h2>
                  <img src="./ethpmlogo.png" width="150" style="float:right;"/>
                  <b>ethPM</b>
                  <h4>
                        <a href="https://docs.ethpm.com/ethpm-developer-guide/ethpm-and-remix-ide" target="_blank">documentation </a> |
                        <a href="https://gitter.im/ethpm/Lobby" target="_blank"> gitter</a>
                  </h4>
                </h2>
                <button
          type="submit"
          style="margin:10px 0 3px 0"
          class="btn btn-lg btn-primary mb-2"
          @click="${() => this.changeView()}"
          ?disabled="${this.creatingPackages}"
        >
          Create a Package
        </button>
                <button
          type="submit"
          style="margin:10px 0 3px 0"
          class="btn btn-lg btn-primary mb-2"
          @click="${() => this.changeView()}"
          ?disabled="${!this.creatingPackages}"
        >
          Import a Package
        </button>
                <div id='creatingPackages'>
                  <div style="margin: 10px 0  0 0" id="form">${form}</div>
                  <div id="alerts" style="margin: 0 0  0 0">${contractAlerts}</div>
                  <div class="list-group" id="manifests">${manifests}</div>
                </div>
                <div id='importingPackages' style='display:none;'>
                <div id="alerts" style="margin: 0 0  0 0">${contractAlerts}</div>
                  ${importManifests}
                  ${sourcesHeader}
                  ${importedSourcesList}
                  <br>
                  ${deploymentsHeader}
                  ${importedDeploymentsList}
                </div>
      </main>
    `;
  }
}
