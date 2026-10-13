import React from 'react';
import { View } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Bell, Bus, FileWarning, GraduationCap, History, Home, LucideIcon, MessageSquareWarning, Trophy, User } from 'lucide-react-native';
import { useAuth } from '../context/AuthContext';
import { useAppTheme } from '../hooks/useAppTheme';
import { fontFamilies } from '../theme/typography';
import DriverHomeScreen from '../screens/driver/DriverHomeScreen';
import ParentHomeScreen from '../screens/parent/ParentHomeScreen';
import ParentAlertsScreen from '../screens/parent/ParentAlertsScreen';
import SchoolDashboardScreen from '../screens/school/SchoolDashboardScreen';
import SchoolComplaintsScreen from '../screens/school/SchoolComplaintsScreen';
import SchoolStudentsScreen from '../screens/school/SchoolStudentsScreen';
import SchoolRankingsScreen from '../screens/school/SchoolRankingsScreen';
import RtoDashboardScreen from '../screens/rto/RtoDashboardScreen';
import RtoViolationsScreen from '../screens/rto/RtoViolationsScreen';
import RtoLiveFleetScreen from '../screens/rto/RtoLiveFleetScreen';
import TripHistoryScreen from '../screens/shared/TripHistoryScreen';
import ProfileScreen from '../screens/shared/ProfileScreen';

interface TabScreen {
  name: string;
  component: React.ComponentType;
  label: string;
  icon: LucideIcon;
}

const Tab = createBottomTabNavigator();

const tabsForRole: Record<string, TabScreen[]> = {
  driver: [
    { name: 'DriverHome', component: DriverHomeScreen, label: 'Home', icon: Home },
    { name: 'TripHistory', component: TripHistoryScreen, label: 'History', icon: History },
    { name: 'Profile', component: ProfileScreen, label: 'Profile', icon: User },
  ],
  parent: [
    { name: 'ParentHome', component: ParentHomeScreen, label: 'Track', icon: Home },
    { name: 'Alerts', component: ParentAlertsScreen, label: 'Alerts', icon: Bell },
    { name: 'Profile', component: ProfileScreen, label: 'Profile', icon: User },
  ],
  school: [
    { name: 'SchoolHome', component: SchoolDashboardScreen, label: 'Fleet', icon: Home },
    { name: 'Students', component: SchoolStudentsScreen, label: 'Students', icon: GraduationCap },
    { name: 'Complaints', component: SchoolComplaintsScreen, label: 'Complaints', icon: MessageSquareWarning },
    { name: 'Rankings', component: SchoolRankingsScreen, label: 'Rankings', icon: Trophy },
    { name: 'Profile', component: ProfileScreen, label: 'Profile', icon: User },
  ],
  rto: [
    { name: 'RtoHome', component: RtoDashboardScreen, label: 'Compliance', icon: Home },
    { name: 'RtoLiveFleet', component: RtoLiveFleetScreen, label: 'Live Fleet', icon: Bus },
    { name: 'Violations', component: RtoViolationsScreen, label: 'Violations', icon: FileWarning },
    { name: 'Profile', component: ProfileScreen, label: 'Profile', icon: User },
  ],
};

export const RoleTabs: React.FC = () => {
  const { user } = useAuth();
  const { colors } = useAppTheme();
  // A missing role is a bug, not a parent: silently showing parent tabs to a
  // school or RTO account hides the real problem. Render nothing instead.
  const roleKey = (user?.role?.toLowerCase() ?? 'parent') as keyof typeof tabsForRole;
  const tabs = tabsForRole[roleKey] ?? tabsForRole.parent;

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#FFFFFF',
        tabBarInactiveTintColor: colors.textTertiary,
        tabBarStyle: {
          position: 'absolute',
          bottom: 24,
          left: 24,
          right: 24,
          backgroundColor: colors.tabBar,
          borderTopWidth: 0,
          borderRadius: 34,
          height: 68,
          paddingBottom: 0,
          paddingHorizontal: 8,
          elevation: 10,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 10 },
          shadowOpacity: 0.4,
          shadowRadius: 20,
        },
        tabBarItemStyle: {
          paddingVertical: 10,
        },
        tabBarLabelStyle: { 
          fontFamily: fontFamilies.medium, 
          fontSize: 10,
          marginTop: 2,
        },
      }}
    >
      {tabs.map(({ name, component, label, icon: Icon }) => (
        <Tab.Screen
          key={name}
          name={name}
          component={component}
          options={{
            title: label,
            tabBarLabel: label,
            tabBarIcon: ({ color, focused }) => (
              <View style={{
                backgroundColor: focused ? colors.primary : 'transparent',
                padding: 8,
                borderRadius: 20,
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                <Icon size={20} color={color} strokeWidth={focused ? 2.5 : 2} />
              </View>
            ),
          }}
        />
      ))}
    </Tab.Navigator>
  );
};
