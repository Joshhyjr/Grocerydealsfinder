import { AlertTriangle, ExternalLink } from 'lucide-react';

export function WorkInProgressNotice() {
  return (
    // Keep the project-status notice shared across every route so visitors see
    // the same expectations and feedback link throughout the application.
    <aside
      className="border-b border-amber-300 bg-amber-50 px-4 py-3 text-amber-950 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100"
      aria-label="Work in progress notice"
    >
      <div className="mx-auto flex max-w-7xl items-start justify-center gap-2 text-sm">
        <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400" />
        <p>
          This website is still a work in progress, and some features may not work properly. Have a
          suggestion? Contact me through my portfolio at{' '}
          <a
            href="https://jkivaria.com"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 font-medium underline underline-offset-2 hover:text-amber-700 dark:hover:text-amber-300"
          >
            jkivaria.com
            <ExternalLink className="size-3" aria-hidden="true" />
          </a>
          .
        </p>
      </div>
    </aside>
  );
}
