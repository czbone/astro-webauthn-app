import { sequence } from 'astro/middleware'
import { access } from './access'

export const onRequest = sequence(access)
