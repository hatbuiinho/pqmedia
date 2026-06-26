import { PUBLIC_API_BASE, PUBLIC_APP_NAME } from '$env/static/public';

export const API_BASE = PUBLIC_API_BASE.replace(/\/$/, '');
export const APP_NAME = PUBLIC_APP_NAME || 'PQ Media';
