import type { ToolSchema } from "../tool-schema";

export const linkedinProfilesSchema: ToolSchema = {
  toolId: "linkedin-profiles",
  version: 1,

  paramGroups: [
    // ── 1. Source ────────────────────────────────────────────────────────
    {
      id: "source",
      label: { en: "Source", es: "Fuente", pt: "Fonte", fr: "Source", de: "Quelle" },
      params: [
        {
          id: "profileUrls",
          apifyField: "profileUrls",
          kind: "keyword_list",
          label: { en: "Profile URLs", es: "URLs de perfiles", pt: "URLs de perfis", fr: "URLs de profils", de: "Profil-URLs" },
          description: {
            en: "LinkedIn profile URLs",
            es: "URLs de perfiles de LinkedIn",
            pt: "URLs de perfis do LinkedIn",
            fr: "URLs de profils LinkedIn",
            de: "LinkedIn-Profil-URLs",
          },
          importance: "critical",
          advanced: false,
          required: true,
          defaultValue: [],
        },
      ],
    },

    // ── 2. Content ──────────────────────────────────────────────────────
    {
      id: "content",
      label: { en: "Content", es: "Contenido", pt: "Conteudo", fr: "Contenu", de: "Inhalt" },
      params: [
        {
          id: "includeSkills",
          apifyField: "includeSkills",
          kind: "boolean",
          label: { en: "Include skills", es: "Incluir habilidades", pt: "Incluir habilidades", fr: "Inclure les competences", de: "Fahigkeiten einschliessen" },
          description: {
            en: "Include skills section from profiles",
            es: "Incluir seccion de habilidades de los perfiles",
            pt: "Incluir secao de habilidades dos perfis",
            fr: "Inclure la section competences des profils",
            de: "Fahigkeiten-Bereich der Profile einschliessen",
          },
          importance: "medium",
          advanced: false,
          required: false,
          defaultValue: true,
        },
        {
          id: "includeExperience",
          apifyField: "includeExperience",
          kind: "boolean",
          label: { en: "Include experience", es: "Incluir experiencia", pt: "Incluir experiencia", fr: "Inclure l'experience", de: "Erfahrung einschliessen" },
          description: {
            en: "Include experience section from profiles",
            es: "Incluir seccion de experiencia de los perfiles",
            pt: "Incluir secao de experiencia dos perfis",
            fr: "Inclure la section experience des profils",
            de: "Erfahrungs-Bereich der Profile einschliessen",
          },
          importance: "medium",
          advanced: false,
          required: false,
          defaultValue: true,
        },
      ],
    },

    // ── 3. Volume ───────────────────────────────────────────────────────
    {
      id: "volume",
      label: { en: "Volume", es: "Volumen", pt: "Volume", fr: "Volume", de: "Volumen" },
      params: [
        {
          id: "maxItems",
          apifyField: "maxItems",
          kind: "number",
          label: { en: "Max profiles", es: "Maximo de perfiles", pt: "Maximo de perfis", fr: "Profils maximum", de: "Max. Profile" },
          description: {
            en: "Maximum number of profiles to return",
            es: "Numero maximo de perfiles a devolver",
            pt: "Numero maximo de perfis a retornar",
            fr: "Nombre maximum de profils a retourner",
            de: "Maximale Anzahl zuruckzugebender Profile",
          },
          importance: "critical",
          advanced: false,
          required: true,
          defaultValue: 25,
          min: 1,
          max: 500,
        },
      ],
    },
  ],

  clarifyingQuestions: [],
};
