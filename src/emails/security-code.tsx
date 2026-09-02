import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Section,
  Text,
} from '@react-email/components';
import * as React from 'react';

interface SecurityCodeProps {
  name?: string | null;
  code: string;
  purpose: 'LOGIN' | 'PASSWORD_RESET';
  expiresInMinutes: number;
}

export default function SecurityCode({
  name,
  code,
  purpose,
  expiresInMinutes,
}: SecurityCodeProps) {
  const isLogin = purpose === 'LOGIN';
  const heading = isLogin ? 'Your sign-in code' : 'Your password reset code';
  const intro = isLogin
    ? 'Use the code below to sign in to JNEX OMS. It works once, and only for this sign-in.'
    : 'Use the code below to choose a new JNEX OMS password. It works once, and only for this reset.';

  return (
    <Html>
      <Head />
      <Preview>{`${code} is your JNEX OMS ${isLogin ? 'sign-in' : 'password reset'} code`}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={h1}>{heading}</Heading>
          <Text style={text}>{name ? `Hello ${name},` : 'Hello,'}</Text>
          <Text style={text}>{intro}</Text>

          <Section style={codeSection}>
            <Text style={codeStyle}>{code}</Text>
            <Text style={codeCaption}>
              Expires in {expiresInMinutes} minutes
            </Text>
          </Section>

          <Text style={warningText}>
            Never share this code. JNEX staff will never ask you for it.
          </Text>

          <Text style={text}>
            If you did not request this, you can ignore this email &ndash; your
            account is unchanged and nobody can use this code without your inbox.
            If it keeps happening, tell your administrator.
          </Text>

          <Text style={{ ...text, ...footer }}>J-nex Holdings IT Team</Text>
        </Container>
      </Body>
    </Html>
  );
}

const main = {
  backgroundColor: '#f6f9fc',
  fontFamily:
    '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Ubuntu,sans-serif',
};

const container = {
  backgroundColor: '#ffffff',
  margin: '0 auto',
  padding: '20px 0 48px',
  marginBottom: '64px',
};

const h1 = {
  color: '#333',
  fontSize: '24px',
  fontWeight: '600',
  lineHeight: '1.4',
  margin: '48px 0 24px',
  textAlign: 'center' as const,
};

const text = {
  color: '#333',
  fontSize: '16px',
  lineHeight: '24px',
  margin: '16px 0',
};

const codeSection = {
  padding: '24px',
  border: '1px solid #f0c2bd',
  borderRadius: '4px',
  margin: '24px 0',
  backgroundColor: '#fdeceb',
  textAlign: 'center' as const,
};

const codeStyle = {
  color: '#b80505',
  fontSize: '38px',
  fontWeight: '700',
  letterSpacing: '10px',
  lineHeight: '1.2',
  margin: '0',
};

const codeCaption = {
  color: '#7f1d1d',
  fontSize: '13px',
  margin: '12px 0 0',
};

const warningText = {
  color: '#e53e3e',
  fontSize: '16px',
  lineHeight: '24px',
  margin: '16px 0',
  fontWeight: '600',
};

const footer = {
  color: '#666',
  fontSize: '14px',
  lineHeight: '24px',
  margin: '48px 0 0',
  fontStyle: 'italic',
};
