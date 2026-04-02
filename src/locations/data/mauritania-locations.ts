/**
 * Fuente de datos oficial para regiones (wilayas) y departamentos (moughataas) de Mauritania.
 * Mantenible y versionable en código. Fuente: subdivisiones administrativas de Mauritania (ANSD, Wikipedia).
 *
 * Estructura: wilayas (regiones) contienen moughataas (departamentos) para selects dependientes.
 */

export interface MoughataaItem {
  code: string;
  name: string;
}

export interface WilayaItem {
  code: string;
  name: string;
  moughataas: MoughataaItem[];
}

/** Lista de wilayas (regiones) con sus moughataas (departamentos). Códigos estables para persistencia. */
export const MAURITANIA_WILAYAS: WilayaItem[] = [
  {
    code: 'adrar',
    name: 'Adrar',
    moughataas: [
      { code: 'aoujeft', name: "Aoujeft" },
      { code: 'atar', name: 'Atar' },
      { code: 'chinguetti', name: 'Chinguetti' },
      { code: 'ouadane', name: 'Ouadane' },
    ],
  },
  {
    code: 'assaba',
    name: 'Assaba',
    moughataas: [
      { code: 'barkeol', name: 'Barkéol' },
      { code: 'boumdeid', name: 'Boumdeid' },
      { code: 'guerou', name: 'Guerou' },
      { code: 'kankossa', name: 'Kankossa' },
      { code: 'kiffa', name: 'Kiffa' },
    ],
  },
  {
    code: 'brakna',
    name: 'Brakna',
    moughataas: [
      { code: 'aleg', name: 'Aleg' },
      { code: 'bababe', name: 'Bababé' },
      { code: 'bogue', name: 'Bogué' },
      { code: 'mbagne', name: "M'Bagne" },
      { code: 'magta_lahjar', name: 'Magta Lahjar' },
      { code: 'male', name: 'Male' },
    ],
  },
  {
    code: 'dakhlet_nouadhibou',
    name: 'Dakhlet Nouadhibou',
    moughataas: [
      { code: 'chami', name: 'Chami' },
      { code: 'nouadhibou', name: 'Nouadhibou' },
    ],
  },
  {
    code: 'gorgol',
    name: 'Gorgol',
    moughataas: [
      { code: 'kaedi', name: 'Kaédi' },
      { code: 'lexeiba', name: 'Lexeiba' },
      { code: 'mbout', name: "M'Bout" },
      { code: 'maghama', name: 'Maghama' },
      { code: 'monguel', name: 'Monguel' },
    ],
  },
  {
    code: 'guidimaka',
    name: 'Guidimaka',
    moughataas: [
      { code: 'ghabou', name: 'Ghabou' },
      { code: 'ould_yenge', name: "Ould Yengé" },
      { code: 'selibaby', name: 'Sélibaby' },
      { code: 'wompou', name: 'Wompou' },
    ],
  },
  {
    code: 'hodh_ech_chargui',
    name: 'Hodh Ech Chargui',
    moughataas: [
      { code: 'adel_bagrou', name: 'Adel Bagrou' },
      { code: 'amourj', name: 'Amourj' },
      { code: 'bassiknou', name: 'Bassiknou' },
      { code: 'djigueni', name: 'Djigueni' },
      { code: 'nbeiket_lehwach', name: "N'Beiket Lehwach" },
      { code: 'nema', name: 'Néma' },
      { code: 'oualata', name: 'Oualata' },
      { code: 'timbedra', name: 'Timbédra' },
    ],
  },
  {
    code: 'hodh_el_gharbi',
    name: 'Hodh El Gharbi',
    moughataas: [
      { code: 'aioun', name: 'Aïoun' },
      { code: 'koubenni', name: 'Koubenni' },
      { code: 'tamchekett', name: 'Tamchekett' },
      { code: 'tintane', name: 'Tintane' },
      { code: 'touil', name: 'Touil' },
    ],
  },
  {
    code: 'inchiri',
    name: 'Inchiri',
    moughataas: [
      { code: 'akjoujt', name: 'Akjoujt' },
      { code: 'benichab', name: 'Bénichab' },
    ],
  },
  {
    code: 'nouakchott_nord',
    name: 'Nouakchott-Nord',
    moughataas: [
      { code: 'dar_naim', name: 'Dar Naïm' },
      { code: 'teyarett', name: 'Teyarett' },
      { code: 'toujounine', name: 'Toujounine' },
    ],
  },
  {
    code: 'nouakchott_ouest',
    name: 'Nouakchott-Ouest',
    moughataas: [
      { code: 'ksar', name: 'Ksar' },
      { code: 'sebkha', name: 'Sebkha' },
      { code: 'tevragh_zeina', name: 'Tevragh Zeina' },
    ],
  },
  {
    code: 'nouakchott_sud',
    name: 'Nouakchott-Sud',
    moughataas: [
      { code: 'arafat', name: 'Arafat' },
      { code: 'el_mina', name: 'El Mina' },
      { code: 'riyad', name: 'Riyad' },
    ],
  },
  {
    code: 'tagant',
    name: 'Tagant',
    moughataas: [
      { code: 'moudjeria', name: 'Moudjéria' },
      { code: 'tichitt', name: 'Tichitt' },
      { code: 'tidjikja', name: 'Tidjikja' },
    ],
  },
  {
    code: 'tiris_zemmour',
    name: 'Tiris Zemmour',
    moughataas: [
      { code: 'bir_moghrein', name: 'Bir Moghrein' },
      { code: 'fderick', name: "F'Déirick" },
      { code: 'zouerate', name: 'Zouérate' },
    ],
  },
  {
    code: 'trarza',
    name: 'Trarza',
    moughataas: [
      { code: 'boutilimit', name: 'Boutilimit' },
      { code: 'keur_macene', name: 'Keur Macène' },
      { code: 'mederdra', name: 'Méderdra' },
      { code: 'ouad_naga', name: 'Ouad Naga' },
      { code: 'rkiz', name: "R'Kiz" },
      { code: 'rosso', name: 'Rosso' },
      { code: 'tekane', name: 'Tékane' },
    ],
  },
];
