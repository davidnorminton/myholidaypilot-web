import { getDb, schema, sql, eq } from './_lib/db.js'
import { requireUser, requireAdmin } from './_lib/auth.js'
import { send, handler } from './_lib/util.js'
const { users, trips, blogPosts, comments, publicTrips, subscribers, regionVisits } = schema

// One cheap round-trip of counts for the admin dashboard strip.
export default handler(async (req, res) => {
  const user = await requireUser(req); requireAdmin(user)
  const db = getDb()
  const count = async (table, where) => {
    const q = db.select({ n: sql`count(*)` }).from(table)
    const [row] = where ? await q.where(where) : await q
    return Number(row?.n || 0)
  }
  const [usersN, tripsN, postsN, commentsN, hiddenN, pubsN, subsN, visitsN] = await Promise.all([
    count(users), count(trips),
    count(blogPosts, eq(blogPosts.status, 'published')),
    count(comments), count(comments, eq(comments.status, 'hidden')),
    count(publicTrips), count(subscribers), count(regionVisits),
  ])
  return send(res, 200, {
    users: usersN, trips: tripsN, posts: postsN,
    comments: commentsN, hiddenComments: hiddenN,
    publications: pubsN, subscribers: subsN, regionVisits: visitsN,
  })
})
