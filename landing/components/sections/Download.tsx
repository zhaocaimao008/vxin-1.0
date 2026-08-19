import { Section, SectionHeading } from '../ui/Section';
import { Button } from '../ui/Button';
import { Reveal } from '../ui/Reveal';
import { download } from '@/lib/content';

export function Download() {
  return (
    <Section id="download" tone="light">
      <SectionHeading
        eyebrow="下载与体验"
        title={download.heading}
        sub={download.sub}
      />
      <div className="mx-auto mt-14 grid max-w-4xl gap-5 sm:grid-cols-3">
        {download.platforms.map((p, i) => (
          <Reveal key={p.key} delay={i * 80}>
            <div
              className="warm-card flex h-full flex-col items-center p-8 text-center"
              style={{ borderRadius: '1.25rem' }}
            >
              <div
                className="flex h-16 w-16 items-center justify-center text-3xl"
                style={{
                  background: 'rgba(20,184,166,0.14)',
                  borderRadius: '1rem',
                  border: '1px solid rgba(20, 184, 166, 0.12)'
                }}
              >
                {p.icon}
              </div>
              <h3
                className="mt-5 font-medium"
                style={{ fontSize: '1.0625rem', color: '#E6EDF3', fontWeight: 500 }}
              >
                {p.name}
              </h3>
              <p
                className="mt-1.5"
                style={{ fontSize: '0.875rem', color: '#94A3B8', fontWeight: 300 }}
              >
                {p.desc}
              </p>
              {p.key === 'android' && (
                <div className="mt-6">
                  {/* 二维码：手机扫码直接下载 APK */}
                  <img
                    src="/downloads/vxin-android-qr.png"
                    alt="v信 Android 下载二维码"
                    width={132}
                    height={132}
                    style={{
                      borderRadius: '0.75rem',
                      background: '#FFFFFF',
                      padding: '8px',
                      border: '1px solid rgba(255,255,255,0.1)',
                      boxShadow: '0 4px 16px rgba(0,0,0,0.2)'
                    }}
                  />
                  <p
                    style={{ fontSize: '0.75rem', color: '#94A3B8', fontWeight: 300, marginTop: '0.5rem' }}
                  >
                    扫码直接下载
                  </p>
                </div>
              )}
              <div className="mt-8 w-full">
                <Button
                  href={p.available ? p.href : undefined}
                  variant={p.available ? 'primary' : 'secondary'}
                  disabled={!p.available}
                  download={p.key === 'android'}
                  className="w-full"
                  style={p.available ? {
                    background: '#14B8A6',
                    color: 'white',
                    borderRadius: '999px',
                    border: 'none',
                    fontWeight: 500,
                    fontSize: '0.9375rem',
                    padding: '0.75rem 1.5rem',
                    boxShadow: '0 2px 6px rgba(20, 184, 166, 0.2)'
                  } : {
                    background: 'transparent',
                    color: '#9AA3A0',
                    borderRadius: '999px',
                    border: '1px solid rgba(255,255,255,0.08)',
                    fontWeight: 400,
                    fontSize: '0.9375rem',
                    padding: '0.75rem 1.5rem'
                  }}
                >
                  {p.cta}
                </Button>
              </div>
            </div>
          </Reveal>
        ))}
      </div>
    </Section>
  );
}
