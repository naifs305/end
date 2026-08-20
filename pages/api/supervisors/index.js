const { withManager, withMethods, ok, fail } = require('../../../lib/server/http');
const identity = require('../../../lib/modules/identity/identity.service');

async function handler(req, res) {
  try {
    return ok(res, await identity.listSupervisors());
  } catch (e) {
    return fail(res, e);
  }
}

module.exports = withMethods(['GET'], withManager(handler));
module.exports.default = module.exports;
