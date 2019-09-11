/**
 * @module "ethpm/storage"
 */

import { Maybe } from "../types";

export interface Service {
  read (uri: URL): Promise<Maybe<string>>;
  hash (content: string): Promise<string>;
  predictUri (content: string): Promise<URL>;
  write (content: string): Promise<URL>;
}
