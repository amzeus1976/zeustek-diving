import {NextResponse} from 'next/server';
import type {NextRequest} from 'next/server';
export function middleware(request:NextRequest){const response=NextResponse.next();if(request.nextUrl.pathname==='/'||request.nextUrl.pathname==='/public-profile'){response.headers.set('cache-control','private, no-store');response.headers.set('x-robots-tag','noindex, nofollow');response.headers.set('referrer-policy','no-referrer');}return response;}
export const config={matcher:['/','/public-profile']};
