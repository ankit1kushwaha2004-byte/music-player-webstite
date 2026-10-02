import pool from '@/lib/db';

export async function DELETE(request, context) {
  try {
    const params = await context.params;
    const trackId = params.id;

    if (!trackId) {
      return Response.json(
        { success: false, error: 'Track ID is required' },
        { status: 400 }
      );
    }

    // Try deleting using either 'id' or 'track_id' depending on your schema
    let result;
    try {
      const [res] = await pool.query('DELETE FROM track WHERE id = ?', [trackId]);
      result = res;
    } catch {
      const [res] = await pool.query('DELETE FROM track WHERE track_id = ?', [trackId]);
      result = res;
    }

    return Response.json({
      success: true,
      message: 'Track removed successfully.',
    });
  } catch (error) {
    console.error('Delete track error:', error);
    return Response.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}