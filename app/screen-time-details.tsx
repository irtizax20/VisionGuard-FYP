import { Redirect } from 'expo-router';
import React from 'react';
// Redirect to the main screen-time page
export default function ScreenTimeDetails() {
  return <Redirect href="/screen-time" />;
}
