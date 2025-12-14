import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase-config';

/**
 * GET /api/ai-validation
 * Fetch AI validation data for specific image(s)
 * Query params:
 * - imageUrl: Single image URL
 * - imageUrls: Comma-separated list of image URLs (for batch fetching)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const imageUrl = searchParams.get('imageUrl');
    const imageUrls = searchParams.get('imageUrls');

    if (!imageUrl && !imageUrls) {
      return NextResponse.json(
        { error: 'Either imageUrl or imageUrls parameter is required' },
        { status: 400 }
      );
    }

    // Batch fetching for multiple images
    if (imageUrls) {
      const urlList = imageUrls.split(',').map(url => url.trim());
      
      const { data, error } = await supabase
        .from('ai_validations')
        .select('*')
        .in('imageUrl', urlList)
        .order('validatedAt', { ascending: false });

      if (error) {
        console.error('Error fetching AI validations:', error);
        return NextResponse.json(
          { error: 'Failed to fetch AI validations' },
          { status: 500 }
        );
      }

      // Return as map for easy lookup: { imageUrl: validationData }
      const validationMap = (data || []).reduce((acc: Record<string, any>, validation: any) => {
        acc[validation.imageUrl] = validation;
        return acc;
      }, {} as Record<string, any>);

      return NextResponse.json({ validations: validationMap });
    }

    // Single image fetching
    const { data, error } = await supabase
      .from('ai_validations')
      .select('*')
      .eq('imageUrl', imageUrl)
      .order('validatedAt', { ascending: false })
      .limit(1)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        // No validation found for this image
        return NextResponse.json({ validation: null });
      }
      console.error('Error fetching AI validation:', error);
      return NextResponse.json(
        { error: 'Failed to fetch AI validation' },
        { status: 500 }
      );
    }

    return NextResponse.json({ validation: data });
  } catch (error) {
    console.error('Error in AI validation API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
