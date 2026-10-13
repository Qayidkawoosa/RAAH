import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { RoleTabs } from './RoleTabs';
import TripSummaryScreen from '../screens/driver/TripSummaryScreen';
import TripDetailScreen from '../screens/shared/TripDetailScreen';
import ReportComplaintScreen from '../screens/parent/ReportComplaintScreen';
import FullMapScreen from '../screens/shared/FullMapScreen';
import SchoolIncidentReviewScreen from '../screens/school/SchoolIncidentReviewScreen';
import SchoolFleetManagementScreen from '../screens/school/SchoolFleetManagementScreen';
import { AppStackParamList } from './types';

const Stack = createNativeStackNavigator<AppStackParamList>();

export const AppNavigator: React.FC = () => (
  <Stack.Navigator screenOptions={{ headerShown: false, animation: 'fade_from_bottom' }}>
    <Stack.Screen name="Tabs" component={RoleTabs} />
    <Stack.Screen name="TripSummary" component={TripSummaryScreen} />
    <Stack.Screen name="TripDetail" component={TripDetailScreen} options={{ animation: 'slide_from_right' }} />
    <Stack.Screen name="ReportComplaint" component={ReportComplaintScreen} options={{ animation: 'slide_from_right' }} />
    <Stack.Screen name="FullMap" component={FullMapScreen} options={{ animation: 'fade' }} />
    <Stack.Screen name="SchoolIncidentReview" component={SchoolIncidentReviewScreen} options={{ animation: 'slide_from_bottom' }} />
    <Stack.Screen name="SchoolFleetManagement" component={SchoolFleetManagementScreen} options={{ animation: 'slide_from_bottom' }} />
  </Stack.Navigator>
);
