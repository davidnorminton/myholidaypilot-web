import { requireUser } from './_lib/auth.js'
import { send, handler } from './_lib/util.js'

// GET or POST /api/me → verifies the Google token (or dev header), upserts the
// user, returns the profile. POST is used as a "sync me on sign-in" call.
export default handler(async (req, res) => {
  const user = await requireUser(req)
  send(res, 200, { user })
})
