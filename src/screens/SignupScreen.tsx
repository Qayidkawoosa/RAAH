import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TouchableOpacity,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { TextInput, ActivityIndicator } from 'react-native-paper';
import { useAuth } from '../context/AuthContext';
import { useAppTheme } from '../hooks/useAppTheme';
import { Mail, Lock, User, Phone, AlertCircle } from 'lucide-react-native';
import { BrandMark } from '../components/BrandMark';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { AuthStackParamList } from '../navigation/types';
import { UserRole } from '../types/auth';
import { tripService } from '../services/tripService';
import { typography } from '../theme/typography';

type SignupScreenNavigationProp = NativeStackNavigationProp<AuthStackParamList, 'Signup'>;

interface Props {
  navigation: SignupScreenNavigationProp;
}

const SignupScreen: React.FC<Props> = ({ navigation }) => {
  const { register, error, clearError } = useAuth();
  const { colors, shadows, isDark } = useAppTheme();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState<UserRole>('driver');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  // Role-specific fields
  const [vehicleNo, setVehicleNo] = useState('');
  const [licenseNo, setLicenseNo] = useState('');
  const [assignedBusNo, setAssignedBusNo] = useState('');
  const [schoolName, setSchoolName] = useState('');
  const [rtoCode, setRtoCode] = useState('');

  const handleSignup = async () => {
    clearError();
    setValidationError(null);

    if (!email.trim() || !password.trim() || !name.trim()) {
      setValidationError('Please complete all standard fields.');
      return;
    }

    // Role-specific validation
    const extraDetails: Record<string, string> = { phone };
    if (role === 'driver') {
      if (!vehicleNo.trim() || !licenseNo.trim()) {
        setValidationError('Drivers must provide Vehicle No. and License.');
        return;
      }
      extraDetails.vehicleNo = vehicleNo.trim();
      extraDetails.licenseNo = licenseNo.trim();
    } else if (role === 'parent') {
      if (!assignedBusNo.trim()) {
        setValidationError('Parents must specify at least one Child Invite Code.');
        return;
      }
    } else if (role === 'school') {
      if (!schoolName.trim()) {
        setValidationError('School administrators must specify School Name.');
        return;
      }
      extraDetails.schoolName = schoolName.trim();
    } else if (role === 'rto') {
      if (!rtoCode.trim()) {
        setValidationError('RTO Authorities must specify their RTO jurisdiction code.');
        return;
      }
      extraDetails.rtoCode = rtoCode.trim();
    }

    setIsSubmitting(true);
    try {
      if (role === 'parent') {
        const codes = assignedBusNo.split(',').map((c) => c.trim().toLowerCase());
        const allStudents = await tripService.getStudents();
        const matched = allStudents.filter((s) => {
          const rawId = s.id.toLowerCase().replace('stu-', 'stu_');
          const normalized = rawId.startsWith('stu_') ? rawId : `stu_${rawId}`;
          const studentName = s.name.toLowerCase();
          return codes.some((code) => {
            return (
              s.id.toLowerCase() === code ||
              normalized === code ||
              s.id.replace('stu_', 'stu-').toLowerCase() === code ||
              studentName.includes(code) ||
              code.includes(studentName)
            );
          });
        });

        if (matched.length === 0) {
          setValidationError(
            'No valid student profiles match the entered invite code(s) or names. Please try default codes STU-1, STU-arman, or student name Arman.'
          );
          setIsSubmitting(false);
          return;
        }

        // Link parent name to matched students in the database
        for (const stu of matched) {
          await tripService.linkParentToStudent(stu.id, name);
        }

        extraDetails.assignedBusNo = matched[0].busNo;
        extraDetails.schoolName = 'Kashmir Valley School';
      }

      await register(email, password, name, role, extraDetails);
    } catch (e: any) {
      console.log('Signup error:', e.message);
      setValidationError(e.message ?? 'Registration failed.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderRoleFields = () => {
    switch (role) {
      case 'driver':
        return (
          <>
            <TextInput
              label="Vehicle Reg No."
              value={vehicleNo}
              onChangeText={setVehicleNo}
              mode="outlined"
              outlineColor={colors.border}
              activeOutlineColor={colors.primary}
              textColor={colors.textPrimary}
              placeholder="e.g. JK-01-A-1234"
              style={[styles.input, { backgroundColor: colors.card }]}
            />
            <TextInput
              label="Commercial Driver License (CDL)"
              value={licenseNo}
              onChangeText={setLicenseNo}
              mode="outlined"
              outlineColor={colors.border}
              activeOutlineColor={colors.primary}
              textColor={colors.textPrimary}
              placeholder="e.g. DL-JK012026"
              style={[styles.input, { backgroundColor: colors.card, marginTop: 12 }]}
            />
          </>
        );
      case 'parent':
        return (
          <>
            <TextInput
              label="Child Invite Code(s)"
              value={assignedBusNo}
              onChangeText={setAssignedBusNo}
              mode="outlined"
              outlineColor={colors.border}
              activeOutlineColor={colors.primary}
              textColor={colors.textPrimary}
              placeholder="e.g. STU-1, STU-arman"
              style={[styles.input, { backgroundColor: colors.card }]}
            />
            <Text style={[typography.caption, { color: colors.textSecondary, marginTop: 6, paddingHorizontal: 4 }]}>
              Enter child invite code(s) (comma separated) to link your parent account. Default codes: STU-1 (Ayaan), STU-arman (Arman), STU-2 (Zoya).
            </Text>
          </>
        );
      case 'school':
        return (
          <TextInput
            label="School Name"
            value={schoolName}
            onChangeText={setSchoolName}
            mode="outlined"
            outlineColor={colors.border}
            activeOutlineColor={colors.primary}
            textColor={colors.textPrimary}
            placeholder="e.g. Burn Hall School Srinagar"
            style={[styles.input, { backgroundColor: colors.card }]}
          />
        );
      case 'rto':
        return (
          <TextInput
            label="RTO Authority Code"
            value={rtoCode}
            onChangeText={setRtoCode}
            mode="outlined"
            outlineColor={colors.border}
            activeOutlineColor={colors.primary}
            textColor={colors.textPrimary}
            placeholder="e.g. JK-01 (Srinagar)"
            style={[styles.input, { backgroundColor: colors.card }]}
          />
        );
    }
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView contentContainerStyle={styles.scrollContainer} showsVerticalScrollIndicator={false}>
          
          <View style={styles.headerSection}>
            <BrandMark size={56} />
            <Text style={[styles.title, { color: colors.textPrimary, marginTop: 12 }]}>Create your RAAH account</Text>
            <Text style={[styles.subtitle, { color: colors.primary }]}>Route & Attendance Assurance Hub</Text>
          </View>

          {/* Role Selection Container */}
          <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>SELECT YOUR PORTAL ROLE</Text>
          <View style={styles.roleContainer}>
            {(['driver', 'parent', 'school', 'rto'] as UserRole[]).map((r) => {
              const active = role === r;
              return (
                <TouchableOpacity
                  key={r}
                  activeOpacity={0.8}
                  onPress={() => {
                    setRole(r);
                    setValidationError(null);
                  }}
                  style={[
                    styles.roleCard, 
                    { 
                      backgroundColor: colors.card,
                      borderColor: active ? colors.primary : colors.border,
                      borderWidth: active ? 2 : 1
                    }
                  ]}
                >
                  <Text style={[
                    styles.roleCardText, 
                    { color: active ? colors.primary : colors.textPrimary, fontFamily: active ? 'Poppins-Bold' : 'Poppins-Medium' }
                  ]}>
                    {r.toUpperCase()}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Form */}
          <View style={[styles.formCard, { backgroundColor: colors.card }, shadows.md]}>
            {(error || validationError) && (
              <View style={[styles.errorAlert, { backgroundColor: colors.danger + '10' }]}>
                <AlertCircle size={18} color={colors.danger} style={styles.errorIcon} />
                <Text style={[styles.errorText, { color: colors.danger }]}>
                  {validationError || error}
                </Text>
              </View>
            )}

            {/* Standard Profile Fields */}
            <View style={styles.inputWrapper}>
              <TextInput
                label="Full Name"
                value={name}
                onChangeText={setName}
                mode="outlined"
                outlineColor={colors.border}
                activeOutlineColor={colors.primary}
                textColor={colors.textPrimary}
                style={[styles.input, { backgroundColor: colors.card }]}
                left={<TextInput.Icon icon={() => <User size={18} color={colors.textSecondary} />} />}
              />
            </View>

            <View style={styles.inputWrapper}>
              <TextInput
                label="Email Address"
                value={email}
                onChangeText={setEmail}
                mode="outlined"
                outlineColor={colors.border}
                activeOutlineColor={colors.primary}
                textColor={colors.textPrimary}
                style={[styles.input, { backgroundColor: colors.card }]}
                keyboardType="email-address"
                autoCapitalize="none"
                left={<TextInput.Icon icon={() => <Mail size={18} color={colors.textSecondary} />} />}
              />
            </View>

            <View style={styles.inputWrapper}>
              <TextInput
                label="Phone Number"
                value={phone}
                onChangeText={setPhone}
                mode="outlined"
                outlineColor={colors.border}
                activeOutlineColor={colors.primary}
                textColor={colors.textPrimary}
                style={[styles.input, { backgroundColor: colors.card }]}
                keyboardType="phone-pad"
                left={<TextInput.Icon icon={() => <Phone size={18} color={colors.textSecondary} />} />}
              />
            </View>

            <View style={styles.inputWrapper}>
              <TextInput
                label="Account Password"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                mode="outlined"
                outlineColor={colors.border}
                activeOutlineColor={colors.primary}
                textColor={colors.textPrimary}
                style={[styles.input, { backgroundColor: colors.card }]}
                left={<TextInput.Icon icon={() => <Lock size={18} color={colors.textSecondary} />} />}
              />
            </View>

            {/* Dynamic Role Fields */}
            <View style={[styles.divider, { backgroundColor: colors.surface }]} />
            <Text style={[styles.roleFieldsHeader, { color: colors.textSecondary }]}>
              {role.toUpperCase()} PROFILE INFORMATION
            </Text>
            <View style={styles.roleFieldsWrapper}>
              {renderRoleFields()}
            </View>

            <TouchableOpacity 
              onPress={handleSignup}
              disabled={isSubmitting}
              activeOpacity={0.8}
              style={[
                styles.submitButton, 
                { backgroundColor: isSubmitting ? colors.primary + '80' : colors.primary },
                shadows.sm
              ]}
            >
              {isSubmitting ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <Text style={styles.submitText}>Complete Registration</Text>
              )}
            </TouchableOpacity>
          </View>

          {/* Toggle back to Login */}
          <View style={styles.footerRow}>
            <Text style={[styles.footerLabel, { color: colors.textSecondary }]}>Already have a portal?</Text>
            <TouchableOpacity 
              onPress={() => {
                clearError();
                setValidationError(null);
                navigation.navigate('Login');
              }}
              activeOpacity={0.7}
            >
              <Text style={[styles.footerLink, { color: colors.primary }]}>Login here</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContainer: {
    padding: 24,
    paddingTop: 16,
  },
  headerSection: {
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontFamily: 'Poppins-Bold',
    fontSize: 24,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontFamily: 'Poppins-Regular',
    fontSize: 13,
    marginTop: 2,
  },
  sectionLabel: {
    fontFamily: 'Poppins-Bold',
    fontSize: 10,
    letterSpacing: 1.2,
    marginBottom: 10,
  },
  roleContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  roleCard: {
    width: '48%',
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  roleCardText: {
    fontSize: 11,
    letterSpacing: 0.8,
  },
  formCard: {
    borderRadius: 24,
    padding: 20,
    width: '100%',
  },
  errorAlert: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    marginBottom: 16,
  },
  errorIcon: {
    marginRight: 8,
  },
  errorText: {
    fontFamily: 'Poppins-Medium',
    fontSize: 12,
    flex: 1,
  },
  inputWrapper: {
    marginBottom: 12,
  },
  input: {
    fontSize: 14,
    fontFamily: 'Poppins-Regular',
    height: 48,
  },
  divider: {
    height: 1,
    marginVertical: 16,
  },
  roleFieldsHeader: {
    fontFamily: 'Poppins-Bold',
    fontSize: 9,
    letterSpacing: 1,
    marginBottom: 12,
  },
  roleFieldsWrapper: {
    marginBottom: 20,
  },
  submitButton: {
    height: 52,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  submitText: {
    fontFamily: 'Poppins-SemiBold',
    fontSize: 15,
    color: '#FFFFFF',
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 32,
  },
  footerLabel: {
    fontFamily: 'Poppins-Regular',
    fontSize: 13,
    marginRight: 6,
  },
  footerLink: {
    fontFamily: 'Poppins-Bold',
    fontSize: 13,
  },
});

export default SignupScreen;
