import { forwardRef } from 'react'

/** next-intl stand-in: returns the key, with values appended so tests can read them. */
export function mockTranslator() {
  const t: any = (key: string, values?: Record<string, string>) =>
    values?.email ? `${key}:${values.email}` : key
  t.rich = (key: string, values?: Record<string, any>) => (
    <>
      {key}
      {values?.name ? `:${values.name}` : ''}
      {values?.email ? `:${values.email}` : ''}
      {values?.link ? values.link('link') : null}
    </>
  )
  return t
}

const MOTION_ONLY = ['initial', 'animate', 'exit', 'whileInView', 'viewport', 'transition']

/** motion/react stand-in that forwards refs (AuthHero focuses its h1). */
export function mockMotion() {
  const make = (tag: string) =>
    forwardRef<any, any>(function MotionStub({ children, ...props }, ref) {
      const clean = Object.fromEntries(Object.entries(props).filter(([k]) => !MOTION_ONLY.includes(k)))
      const Tag = tag as any
      return <Tag ref={ref} {...clean}>{children}</Tag>
    })
  return { motion: { h1: make('h1'), p: make('p'), div: make('div'), form: make('form') } }
}
