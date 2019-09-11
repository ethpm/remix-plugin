/**
 * @module "ethpm/manifests"
 */

import { Package } from "../package";

export interface Service {
  read (json: string): Promise<Package>;
  write (pkg: Package): Promise<string>;
}
