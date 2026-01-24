import { NextRequest, NextResponse } from 'next/server';

// Farcaster webhook handler for notifications
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Handle different webhook events
    const { event, data } = body;
    
    switch (event) {
      case 'miniapp.added':
        // User added the Mini App
        console.log('User added Mini App:', data);
        break;
        
      case 'miniapp.removed':
        // User removed the Mini App
        console.log('User removed Mini App:', data);
        break;
        
      case 'notification.sent':
        // Notification was sent
        console.log('Notification sent:', data);
        break;
        
      default:
        console.log('Unknown webhook event:', event, data);
    }
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Webhook error:', error);
    return NextResponse.json(
      { error: 'Webhook processing failed' },
      { status: 500 }
    );
  }
}

// Verify webhook is reachable
export async function GET() {
  return NextResponse.json({ 
    status: 'ok',
    message: 'FlashEvent webhook endpoint is active'
  });
}
