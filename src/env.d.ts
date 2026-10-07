/// <reference path="../.astro/types.d.ts" />
/// <reference types="astro/client" />

declare namespace App {
  interface Locals {
    access: import('./server/auth/access').PageAccess
  }
}
