import { createHandler } from '../../server/admin.mjs';
const keys = ['ADMIN_USERNAME', 'ADMIN_PASSWORD_HASH', 'SESSION_SECRET', 'GEMINI_API_KEY', 'GEMINI_MODEL', 'GITHUB_TOKEN', 'GITHUB_REPO', 'GITHUB_BRANCH', 'DRAFTS_REPO', 'DRAFTS_BRANCH', 'SITE_ORIGIN', 'POSTS_PATH', 'IMAGES_PATH'];
export default (request, context) => {
  const env = Object.fromEntries(keys.map(key => [key, globalThis.Netlify?.env.get(key) ?? process.env[key]]));
  return createHandler(env)(request, context);
};
export const config = { rateLimit: { windowLimit: 60, windowSize: 60, aggregateBy: ['ip'] } };
