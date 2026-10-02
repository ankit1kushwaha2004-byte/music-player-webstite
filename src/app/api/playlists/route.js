import pool from '@/lib/db';

export async function GET() {
  try {
    const [rows] = await pool.query(`
      SELECT 
        COALESCE(p.id, t.playlist_id) AS playlist_id,
        COALESCE(p.title, 'My Playlist') AS playlist_name,
        t.id AS track_id,
        t.youtube_id,
        t.title AS track_title,
        COALESCE(t.channel_title, '') AS channel_title
      FROM track t
      LEFT JOIN playlists p ON t.playlist_id = p.id
      ORDER BY t.id DESC;
    `);

    return Response.json({ success: true, data: rows });
  } catch (error) {
    console.error('Fetch tracks API error:', error);
    return Response.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}