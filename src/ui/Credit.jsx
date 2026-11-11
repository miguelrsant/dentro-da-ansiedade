// The author's signature, small and low in the corner of the last screen: "Site desenvolvido por", the author's
// crowned M (traced from the logo) and the author's name, linking to the author's site, followed by the author's
// Instagram, this project's repository and the About page.
export default function Credit() {
  return (
    <p className="credit">
      <a className="credit-by" href="https://miguelrsant.com.br" target="_blank" rel="noopener">
        <span>Site desenvolvido por</span>
        <svg viewBox="2.5 4 26 23.5" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M7.9 5.3v1.4M22.9 5.3v1.4" strokeWidth="1.5" />
          <path d="M5.9 19.8L8 8.4l7.5 7.9 7.5-7.9 1.6 11.4" strokeWidth="1.7" />
          <path d="M3.8 21.6c3-.4 6.5-.7 10-.8L27.2 20.6" strokeWidth="1.7" />
          <path d="M9.5 21.6v4M15.5 21.4v2.2M20.5 21.2v5.3" strokeWidth="1.25" />
        </svg>
        <b>Miguel Angelo</b>
      </a>
      <span className="credit-links">
        <a href="https://www.instagram.com/miguelrsant/" target="_blank" rel="noopener">Instagram</a>
        <a href="https://github.com/miguelrsant/dentro-da-ansiedade" target="_blank" rel="noopener">GitHub</a>
        <a href="/sobre">Sobre</a>
      </span>
    </p>
  );
}
