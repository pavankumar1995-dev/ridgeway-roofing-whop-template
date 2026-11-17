import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import {cloudflare} from '@cloudflare/vite-plugin';
import { whop } from '@whop/cli/vite';
export default defineConfig({plugins:[cloudflare({viteEnvironment:{name:'ssr'}}),react(),...whop()],environments:{client:{build:{outDir:'dist/client'}},ssr:{build:{outDir:'dist/server'}}},server:{port:5173}});
