import { CONFIG } from './arguments';
const { prod: DEPLOY_CONFIG } = CONFIG;
const { owner } = DEPLOY_CONFIG

export default [10 * 60, [owner], [owner], owner];