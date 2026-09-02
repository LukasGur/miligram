import { appleSplashLinks } from "@/lib/splashScreens";

/**
 * Next vypisuje jen standardizované `mobile-web-app-capable`. Safari ho čte
 * až od iOS 16.4 — starší iPhony by aplikaci spustily v prohlížeči, takže
 * legacy meta doplňujeme ručně. Startovací obrazovky metadata API nezná vůbec.
 * React 19 obojí vytáhne do <head> sám.
 */
export function IosStandaloneTags() {
  return (
    <>
      <meta name="apple-mobile-web-app-capable" content="yes" />
      {appleSplashLinks.map((link) => (
        <link key={link.href} rel="apple-touch-startup-image" href={link.href} media={link.media} />
      ))}
    </>
  );
}
