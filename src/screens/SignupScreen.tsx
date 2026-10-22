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
import { Mail, Lock, User, Phone, AlertCircle, KeyRound, Info } from 'lucide-react-native';
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

// ── Client-side validation helpers ──────────────────────────────────────────
const EMAIL_RE    = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE    = /^[6-9]\d{9}$/;
const NAME_RE     = /^[A-Za-z\s]{3,}$/;
const PLATE_RE    = /^JK[- ]?[0-9]{2}[- ]?[A-Z]{1,2}[- ]?[0-9]{4}$/i;
const PW_UPPER    = /[A-Z]/;
const PW_LOWER    = /[a-z]/;
const PW_DIGIT    = /[0-9]/;
const PW_SPECIAL  = /[^A-Za-z0-9]/;

function getPasswordStrength(pw: string) {
  return {
    length:  pw.length >= 8,
    upper:   PW_UPPER.test(pw),
    lower:   PW_LOWER.test(pw),
    digit:   PW_DIGIT.test(pw),
    special: PW_SPECIAL.test(pw),
  };
}

const SignupScreen: React.FC<Props> = ({ navigation }) => {
  const { register, error, clearError } = useAuth();
  const { colors, shadows, isDark } = useAppTheme();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState<UserRole>('parent');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  // Role-specific fields
  const [vehicleNo, setVehicleNo] = useState('');
  const [licenseNo, setLicenseNo] = useState('');
  const [assignedBusNo, setAssignedBusNo] = useState('');
  const [schoolName, setSchoolName] = useState('');
  const [rtoCode, setRtoCode] = useState('');
  const [orgSecretKey, setOrgSecretKey] = useState('');

  const pwStrength = getPasswordStrength(password);
  const pwValid    = Object.values(pwStrength).every(Boolean);

  const handleSignup = async () => {
    clearError();
    setValidationError(null);

    // ── Name ──────────────────────────────────────────────────────────
    if (!NAME_RE.test(name.trim())) {
      setValidationError('Name must be at least 3 characters and contain only letters.');
      return;
    }

    // ── Email ─────────────────────────────────────────────────────────
    if (!EMAIL_RE.test(email.trim())) {
      setValidationError('Please enter a valid email address.');
      return;
    }

    // ── Password policy ───────────────────────────────────────────────
    if (!pwValid) {
      setValidationError(
        'Password must be at least 8 characters with 1 uppercase, 1 lowercase, 1 number, and 1 special character.'
      );
      return;
    }

    // ── Phone (if entered) ────────────────────────────────────────────
    if (phone.trim() && !PHONE_RE.test(phone.trim())) {
      setValidationError('Enter a valid 10-digit Indian phone number (starts with 6–9).');
      return;
    }

    // ── Role-specific validation ──────────────────────────────────────
    const extraDetails: Record<string, string> = { phone: phone.trim() };
    if (role === 'driver') {
      if (!vehicleNo.trim() || !licenseNo.trim()) {
        setValidationError('Drivers must provide Vehicle No. and License.');
        return;
      }
      if (!PLATE_RE.test(vehicleNo.trim())) {
        setValidationError('Vehicle plate must be a valid J&K format (e.g. JK-01-A-1234).');
        return;
      }
      extraDetails.vehicleNo = vehicleNo.trim().toUpperCase();
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
      if (!orgSecretKey.trim()) {
        setValidationError('An Organization Secret Key is required for School Admin registration.');
        return;
      }
      extraDetails.schoolName    = schoolName.trim();
      extraDetails.orgSecretKey  = orgSecretKey.trim();
    } else if (role === 'rto') {
      if (!rtoCode.trim()) {
        setValidationError('RTO Authorities must specify their RTO jurisdiction code.');
        return;
      }
      if (!orgSecretKey.trim()) {
        setValidationError('An Organization Secret Key is required for RTO registration.');
        return;
      }
      extraDetails.rtoCode      = rtoCode.trim();
      extraDetails.orgSecretKey = orgSecretKey.trim();
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
      // Surface API duplicate / forbidden messages directly
      const msg: string = e?.response?.data?.message ?? e.message ?? 'Registration failed.';
      setValidationError(msg);
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
              onChangeText={(t) => setVehicleNo(t.toUpperCase())}
              mode="outlined"
              outlineColor={PLATE_RE.test(vehicleNo) ? colors.primary : colors.border}
              activeOutlineColor={colors.primary}
              textColor={colors.textPrimary}
              placeholder="e.g. JK-01-A-1234"
              autoCapitalize="characters"
              style={[styles.input, { backgroundColor: colors.card }]}
            />
            {vehicleNo.length > 2 && !PLATE_RE.test(vehicleNo) && (
              <Text style={[typography.caption, { color: colors.danger, marginTop: 4, paddingHorizontal: 4 }]}>
                Must match J&K format: JK-01-A-1234
              </Text>
            )}
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
          <>
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
            <TextInput
              label="Organization Secret Key"
              value={orgSecretKey}
              onChangeText={setOrgSecretKey}
              secureTextEntry
              mode="outlined"
              outlineColor={colors.border}
              activeOutlineColor={colors.primary}
              textColor={colors.textPrimary}
              placeholder="Provided by RAAH admin"
              style={[styles.input, { backgroundColor: colors.card, marginTop: 12 }]}
              left={<TextInput.Icon icon={() => <KeyRound size={18} color={colors.textSecondary} />} />}
            />
          </>
        );
      case 'rto':
        return (
          <>
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
            <TextInput
              label="Organization Secret Key"
              value={orgSecretKey}
              onChangeText={setOrgSecretKey}
              secureTextEntry
              mode="outlined"
              outlineColor={colors.border}
              activeOutlineColor={colors.primary}
              textColor={colors.textPrimary}
              placeholder="Provided by RAAH admin"
              style={[styles.input, { backgroundColor: colors.card, marginTop: 12 }]}
              left={<TextInput.Icon icon={() => <KeyRound size={18} color={colors.textSecondary} />} />}
            />
          </>
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
            {(['parent', 'school', 'rto'] as UserRole[]).map((r) => {
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

          {/* Admin Credentials Notice for Drivers */}
          <View style={[styles.driverNoticeCard, { backgroundColor: `${colors.primary}12`, borderColor: `${colors.primary}33` }]}>
            <Info size={16} color={colors.primary} style={{ marginRight: 8, marginTop: 1 }} />
            <Text style={[typography.caption, { color: colors.textSecondary, flex: 1 }]}>
              Drivers and staff credentials are issued by the school administration.
            </Text>
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
              {password.length > 0 && (
                <View style={{ marginTop: 6, paddingHorizontal: 4, gap: 2 }}>
                  {(
                    [
                      [pwStrength.length,  'At least 8 characters'],
                      [pwStrength.upper,   '1 uppercase letter'],
                      [pwStrength.lower,   '1 lowercase letter'],
                      [pwStrength.digit,   '1 number'],
                      [pwStrength.special, '1 special character'],
                    ] as [boolean, string][]
                  ).map(([ok, label]) => (
                    <Text
                      key={label}
                      style={[typography.caption, { color: ok ? '#22c55e' : colors.danger }]}
                    >
                      {ok ? '✓' : '✗'} {label}
                    </Text>
                  ))}
                </View>
              )}
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
    justifyContent: 'space-between',
    marginBottom: 12,
    gap: 8,
  },
  roleCard: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  roleCardText: {
    fontSize: 11,
    letterSpacing: 0.8,
  },
  driverNoticeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 20,
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
