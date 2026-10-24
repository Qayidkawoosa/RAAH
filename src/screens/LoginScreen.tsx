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
import { Mail, Phone, Lock, Eye, EyeOff, LogIn, AlertCircle } from 'lucide-react-native';
import { BrandMark } from '../components/BrandMark';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { AuthStackParamList } from '../navigation/types';

type LoginScreenNavigationProp = NativeStackNavigationProp<AuthStackParamList, 'Login'>;

interface Props {
  navigation: LoginScreenNavigationProp;
}

const LoginScreen: React.FC<Props> = ({ navigation }) => {
  const { login, error, clearError } = useAuth();
  const { colors, shadows, isDark } = useAppTheme();
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  const handleLogin = async () => {
    clearError();
    setValidationError(null);

    if (!email.trim() || !password.trim()) {
      setValidationError('Please fill in your Phone Number/Email and Password.');
      return;
    }

    setIsSubmitting(true);
    try {
      await login(email, password);
    } catch (e: any) {
      console.log('Login error:', e.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView 
          contentContainerStyle={styles.scrollContainer} 
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Logo & Tagline */}
          <View style={styles.headerSection}>
            <View style={styles.logoIconContainer}>
              <BrandMark size={76} />
            </View>
            <Text style={[styles.logoText, { color: colors.textPrimary }]}>RAAH</Text>
            <Text style={[styles.tagline, { color: colors.primary }]}>
              Route & Attendance Assurance Hub
            </Text>
            <Text style={[styles.tagline, { color: colors.textSecondary, marginTop: 4 }]}>
              Every School Trip. Safe. Smart. Connected.
            </Text>
          </View>

          {/* Card Form */}
          <View style={[styles.formCard, { backgroundColor: colors.card }, shadows.md]}>
            <Text style={[styles.formTitle, { color: colors.textPrimary }]}>Welcome back</Text>
            <Text style={[styles.formSub, { color: colors.textSecondary }]}>Sign in with Phone Number or Email</Text>

            {/* Error alerts */}
            {(error || validationError) && (
              <View style={[styles.errorAlert, { backgroundColor: colors.danger + '10' }]}>
                <AlertCircle size={18} color={colors.danger} style={styles.errorIcon} />
                <Text style={[styles.errorText, { color: colors.danger }]}>
                  {validationError || error}
                </Text>
              </View>
            )}

            {/* Phone Number / Email Field */}
            <View style={styles.inputWrapper}>
              <TextInput
                label="Phone Number or Email"
                value={email}
                onChangeText={(text) => {
                  setEmail(text);
                  if (validationError) setValidationError(null);
                }}
                mode="outlined"
                outlineColor={colors.border}
                activeOutlineColor={colors.primary}
                textColor={colors.textPrimary}
                style={[styles.input, { backgroundColor: colors.card }]}
                keyboardType="default"
                autoCapitalize="none"
                autoCorrect={false}
                left={
                  <TextInput.Icon 
                    icon={() => (
                      /^[0-9+ -]+$/.test(email.trim()) && email.trim().length > 0 ? (
                        <Phone size={18} color={colors.primary} />
                      ) : (
                        <Mail size={18} color={colors.textSecondary} />
                      )
                    )} 
                  />
                }
              />
            </View>

            {/* Password Field */}
            <View style={styles.inputWrapper}>
              <TextInput
                label="Password"
                value={password}
                onChangeText={(text) => {
                  setPassword(text);
                  if (validationError) setValidationError(null);
                }}
                secureTextEntry={!showPassword}
                mode="outlined"
                outlineColor={colors.border}
                activeOutlineColor={colors.primary}
                textColor={colors.textPrimary}
                style={[styles.input, { backgroundColor: colors.card }]}
                autoCapitalize="none"
                left={<TextInput.Icon icon={() => <Lock size={18} color={colors.textSecondary} />} />}
                right={
                  <TextInput.Icon 
                    icon={() => showPassword ? (
                      <EyeOff size={18} color={colors.textSecondary} />
                    ) : (
                      <Eye size={18} color={colors.textSecondary} />
                    )}
                    onPress={() => setShowPassword(!showPassword)}
                  />
                }
              />
            </View>

            {/* Forgot Password Link */}
            <TouchableOpacity style={styles.forgotContainer} activeOpacity={0.7}>
              <Text style={[styles.forgotText, { color: colors.secondaryAccent }]}>Forgot Password?</Text>
            </TouchableOpacity>

            {/* Submit Button */}
            <TouchableOpacity 
              onPress={handleLogin}
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
                <View style={styles.buttonInner}>
                  <LogIn size={18} color="#FFFFFF" style={styles.btnIcon} />
                  <Text style={styles.submitText}>Sign in</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>

          {/* Toggle to Signup */}
          <View style={styles.footerRow}>
            <Text style={[styles.footerLabel, { color: colors.textSecondary }]}>Need a portal account?</Text>
            <TouchableOpacity 
              onPress={() => {
                clearError();
                setValidationError(null);
                navigation.navigate('Signup');
              }}
              activeOpacity={0.7}
            >
              <Text style={[styles.footerLink, { color: colors.primary }]}>Register here</Text>
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
    justifyContent: 'center',
    minHeight: '100%',
  },
  headerSection: {
    alignItems: 'center',
    marginBottom: 28,
  },
  logoIconContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  logoText: {
    fontFamily: 'Poppins-Bold',
    fontSize: 26,
    letterSpacing: -0.5,
  },
  tagline: {
    fontFamily: 'Poppins-Regular',
    fontSize: 13,
    marginTop: 6,
    textAlign: 'center',
  },
  formCard: {
    borderRadius: 24,
    padding: 24,
    width: '100%',
  },
  formTitle: {
    fontFamily: 'Poppins-Bold',
    fontSize: 20,
  },
  formSub: {
    fontFamily: 'Poppins-Regular',
    fontSize: 12,
    marginTop: 2,
    marginBottom: 20,
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
    marginBottom: 16,
  },
  input: {
    fontSize: 14,
    fontFamily: 'Poppins-Regular',
    height: 52,
  },
  forgotContainer: {
    alignSelf: 'flex-end',
    marginBottom: 20,
  },
  forgotText: {
    fontFamily: 'Poppins-SemiBold',
    fontSize: 12,
  },
  submitButton: {
    height: 54,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  buttonInner: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  btnIcon: {
    marginRight: 8,
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
    marginTop: 24,
    marginBottom: 20,
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

export default LoginScreen;
