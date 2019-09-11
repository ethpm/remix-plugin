/**
 * @module "ethpm/config"
 */


import * as config from "./config";

export function load<S>(plugin: config.ConfigValue<S>): config.Connector<S> {
  const required =
	(typeof plugin == "string" && plugin.includes('manifests'))
	  ? require('../manifests/v2') :
	(typeof plugin == "string" && plugin.includes('storage'))
	  ? require('../storage/ipfs') :
    (typeof plugin == "function")
      ? plugin :
    (typeof plugin == "object" && plugin.default)
      ? plugin.default : undefined;

  // HACK check for .default
  const connector = (typeof required == "object" && required.default)
    ? required.default
    : required;

  return new connector();
}
