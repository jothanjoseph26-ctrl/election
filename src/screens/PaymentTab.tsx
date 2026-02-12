import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { View, Text } from 'react-native';
import { PaymentStatusScreen } from './PaymentStatusScreen';

export default function PaymentTab() {
  return (
    <View style={{ flex: 1 }}>
      <PaymentStatusScreen />
    </View>
  );
}