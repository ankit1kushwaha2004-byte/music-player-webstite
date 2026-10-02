import pool from '@/lib/db';

export async function POST(request) {
  try {
    const { playlistUrl } = await request.json();

    if (!playlistUrl) {
      return Response.json(
        { success: false, error: 'Playlist URL is required' },
        { status: 400 }
      );
    }

    // Extract Playlist ID from URL
    const url = new URL(playlistUrl);
    const playlistIdParam = url.searchParams.get('list');

    if (!playlistIdParam) {
      return Response.json(
        { success: false, error: 'Invalid YouTube playlist URL' },
        { status: 400 }
      );
    }

    const apiKey = process.env.YOUTUBE_API_KEY;
    if (!apiKey) {
      return Response.json(
        { success: false, error: 'YouTube API key is missing in .env.local' },
        { status: 500 }
      );
    }

    // 1. Fetch Playlist Title from YouTube Data API
    const playlistMetaRes = await fetch(
      `https://www.googleapis.com/youtube/v3/playlists?part=snippet&id=${playlistIdParam}&key=${apiKey}`
    );
    const playlistMetaData = await playlistMetaRes.json();

    if (!playlistMetaData.items || playlistMetaData.items.length === 0) {
      return Response.json(
        { success: false, error: 'Playlist not found or is set to private' },
        { status: 404 }
      );
    }

    const playlistTitle = playlistMetaData.items[0].snippet.title;

    // 2. Insert or get existing playlist record
    const [existing] = await pool.query(
      'SELECT id FROM playlists WHERE youtube_playlist_id = ?',
      [playlistIdParam]
    );

    let dbPlaylistId;
    if (existing.length > 0) {
      dbPlaylistId = existing[0].id;
    } else {
      const [insertRes] = await pool.query(
        'INSERT INTO playlists (youtube_playlist_id, title) VALUES (?, ?)',
        [playlistIdParam, playlistTitle]
      );
      dbPlaylistId = insertRes.insertId;
    }

    // 3. Fetch Playlist Items from YouTube
    const itemsRes = await fetch(
      `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&maxResults=50&playlistId=${playlistIdParam}&key=${apiKey}`
    );
    const itemsData = await itemsRes.json();

    if (!itemsData.items || itemsData.items.length === 0) {
      return Response.json(
        { success: false, error: 'No videos found in this playlist' },
        { status: 404 }
      );
    }

    // 4. Insert each track into the track table using `youtube_id`
    for (let i = 0; i < itemsData.items.length; i++) {
      const item = itemsData.items[i];
      const videoId = item.snippet.resourceId?.videoId;
      const title = item.snippet.title;
      const channelTitle = item.snippet.videoOwnerChannelTitle || item.snippet.channelTitle || '';

      // Skip deleted or private videos
      if (!videoId || title === 'Private video' || title === 'Deleted video') continue;

      await pool.query(
        `INSERT INTO track (playlist_id, youtube_id, title, channel_title, position)
         VALUES (?, ?, ?, ?, ?)`,
        [dbPlaylistId, videoId, title, channelTitle, i]
      );
    }

    return Response.json({
      success: true,
      message: `Successfully imported "${playlistTitle}" with ${itemsData.items.length} tracks!`,
    });
  } catch (error) {
    console.error('Import error:', error);
    return Response.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}