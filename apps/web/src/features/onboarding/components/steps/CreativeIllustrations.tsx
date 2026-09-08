import { useId } from "react";
import type { ContentChoice } from "@/features/onboarding/public/content-choice";

/** Local, decorative vector artwork for the mobile creative cards. */
export function CreativeIllustration({
  kind,
  className,
}: {
  kind: ContentChoice;
  className?: string;
}) {
  const id = useId().replaceAll(":", "");
  return (
    <svg
      className={className}
      viewBox="0 0 120 100"
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <linearGradient
          id={`${id}-purple`}
          x1="20"
          y1="8"
          x2="101"
          y2="90"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#DDD0FF" />
          <stop offset="1" stopColor="#A991F5" />
        </linearGradient>
        <linearGradient
          id={`${id}-bright`}
          x1="48"
          y1="20"
          x2="75"
          y2="81"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#743DFF" />
          <stop offset="1" stopColor="#4218D9" />
        </linearGradient>
      </defs>
      {kind === "personalized-video" ? (
        <>
          <rect x="8" y="36" width="91" height="53" rx="4" fill="#DAD2ED" />
          <path
            d="M13 81h69"
            stroke="white"
            strokeWidth="2"
            strokeLinecap="round"
          />
          <circle cx="90" cy="81" r="2" fill="white" />
          <rect
            x="24"
            y="18"
            width="90"
            height="58"
            rx="4"
            fill={`url(#${id}-purple)`}
          />
          <path d="M24 42c14 6 19 14 18 34H24V42Z" fill="#C0ABF7" />
          <path d="M114 29c-22 0-17 31 0 31V29Z" fill="#9976DE" />
          <path d="M85 34c-8 6-8 13 0 19 8-6 8-13 0-19Z" fill="#E5D9FF" />
          <circle cx="63" cy="48" r="14" fill="#fff" />
          <path d="m60 41 10 7-10 7V41Z" fill="#683AF5" />
          <path d="M37 54c-6 4-6 10 0 14 5-4 5-10 0-14Z" fill="#EEE4FF" />
          <path
            d="m13 21 1.5 4.5L19 27l-4.5 1.5L13 33l-1.5-4.5L7 27l4.5-1.5L13 21Z"
            fill="#D7C4FF"
          />
        </>
      ) : kind === "ai-video" ? (
        <>
          <path
            d="m39 17 4 13m24-12-4 12"
            stroke="#C6B0F5"
            strokeWidth="3"
            strokeLinecap="round"
          />
          <circle cx="38" cy="15" r="3" fill="#B99AEA" />
          <rect x="31" y="30" width="46" height="43" rx="17" fill="#EEEBF6" />
          <rect x="23" y="43" width="9" height="19" rx="4" fill="#E0DAEA" />
          <rect x="76" y="43" width="9" height="19" rx="4" fill="#E0DAEA" />
          <rect x="34" y="37" width="39" height="25" rx="12" fill="#211047" />
          <circle cx="45" cy="49" r="3" fill="white" />
          <circle cx="62" cy="49" r="3" fill="white" />
          <path
            d="M46 73h17"
            stroke="#E4DEED"
            strokeWidth="6"
            strokeLinecap="round"
          />
          <rect
            x="76"
            y="63"
            width="28"
            height="22"
            rx="4"
            fill={`url(#${id}-bright)`}
          />
          <path d="m86 68 10 6-10 6V68Z" fill="white" />
          <path
            d="m86 14 3 8 7 3-7 3-3 8-3-8-7-3 7-3 3-8Zm11 23 1.5 4.5L103 43l-4.5 1.5L97 49l-1.5-4.5L91 43l4.5-1.5L97 37Z"
            fill="#B594FF"
          />
        </>
      ) : kind === "your-video" ? (
        <>
          <path
            d="M33 74C9 73 9 41 31 38c6-28 38-27 48 0 22-1 29 35 6 36H33Z"
            fill="#EFEBF8"
            stroke="#EAE4F4"
            strokeWidth="1.5"
          />
          <path
            d="M58 61V43m-10 10 10-11 10 11"
            stroke="#392174"
            strokeWidth="2.7"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <rect
            x="75"
            y="64"
            width="28"
            height="22"
            rx="4"
            fill={`url(#${id}-bright)`}
          />
          <path d="m85 69 10 6-10 6V69Z" fill="white" />
        </>
      ) : (
        <>
          <path
            d="M33 5h40l18 19v68H33a4 4 0 0 1-4-4V9a4 4 0 0 1 4-4Z"
            fill="#EFECF7"
            stroke="#D6D2E1"
            strokeWidth="1.5"
          />
          <path d="M73 5v19h18" fill="#DED9EC" />
          <path
            d="M42 36h21m-21 12h35M42 60h35"
            stroke="#B7B1CB"
            strokeWidth="3"
          />
          <rect
            x="23"
            y="70"
            width="41"
            height="21"
            rx="3"
            fill={`url(#${id}-bright)`}
          />
          <text
            x="43.5"
            y="85"
            textAnchor="middle"
            fill="white"
            fontSize="12"
            fontWeight="700"
            fontFamily="Arial, sans-serif"
          >
            PDF
          </text>
        </>
      )}
    </svg>
  );
}

export function FilePreviewIllustration({
  document = false,
  className,
}: {
  document?: boolean;
  className?: string;
}) {
  return (
    <svg
      className={className}
      viewBox="0 0 160 160"
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      <path
        d="M43 15h55l29 30v96a6 6 0 0 1-6 6H43a6 6 0 0 1-6-6V21a6 6 0 0 1 6-6Z"
        fill="white"
        stroke={document ? "#D0D2DA" : "#A7AAB5"}
        strokeWidth="2.3"
      />
      <path
        d="M98 16v24a5 5 0 0 0 5 5h23"
        fill={document ? "#CDD0D7" : "#F9F9FC"}
        stroke={document ? "#CDD0D7" : "#A7AAB5"}
        strokeWidth="2.3"
        strokeLinejoin="round"
      />
      {document ? (
        <>
          <rect x="32" y="55" width="56" height="33" rx="4" fill="#EA2220" />
          <text
            x="60"
            y="79"
            textAnchor="middle"
            fill="white"
            fontSize="22"
            fontWeight="700"
            fontFamily="Arial, sans-serif"
          >
            PDF
          </text>
          <path
            d="M55 101h53m-53 13h53m-53 13h34"
            stroke="#D9DBE1"
            strokeWidth="4"
            strokeLinecap="round"
          />
        </>
      ) : (
        <>
          <rect x="60" y="77" width="31" height="29" rx="5" fill="#A6A8B2" />
          <path d="m90 86 13-8v27l-13-8V86Z" fill="#A6A8B2" />
          <circle cx="129" cy="137" r="24" fill="#E9E9EE" opacity=".5" />
          <circle cx="128" cy="133" r="22" fill="white" />
          <path d="m122 123 15 10-15 10v-20Z" fill="#080D20" />
        </>
      )}
    </svg>
  );
}
