// LIVE POSITION DIAGNOSTIC — v2
// Browser console diagnostic. Reads fm-clone-save only. Does NOT modify production state.

(() => {
  const raw = localStorage.getItem('fm-clone-save');
  if (!raw) { console.error('fm-clone-save bulunamadı'); return; }

  const persisted = JSON.parse(raw);
  const state = persisted.state;
  if (!state?.players || !state?.clubs || !state?.userClubId) {
    console.error('state eksik alanlar'); return;
  }

  const players = state.players;
  const userClubId = state.userClubId;
  const userClub = state.clubs[userClubId];
  const userLineup = state.userLineup || [];

  const nextFixture = (state.fixtures || []).find(
    f => f.week === state.currentWeek &&
      (f.homeId === userClubId || f.awayId === userClubId)
  );
  const opponentId = nextFixture
    ? (nextFixture.homeId === userClubId ? nextFixture.awayId : nextFixture.homeId)
    : Object.keys(state.clubs).find(id => id !== userClubId);
  const opponent = state.clubs[opponentId];

  const PITCH_LENGTH = 104;
  const PITCH_WIDTH = 64;

  function getXOffsetForPosition(position) {
    switch (position) {
      case 'GK': return 5;
      case 'DL': case 'DC': case 'DR': return 18;
      case 'WBL': case 'WBR': return 30;
      case 'DMC': return 38;
      case 'ML': case 'MC': case 'MR': return 48;
      case 'AML': case 'AMC': case 'AMR': return 65;
      case 'ST': case 'KFL': case 'KFR': case 'GF': return 80;
      default: return 50;
    }
  }

  function getYOffsetForPosition(position) {
    const center = PITCH_WIDTH / 2;
    switch (position) {
      case 'GK': case 'DC': case 'DMC': case 'MC': case 'AMC':
      case 'ST': case 'GF': return center;
      case 'DL': case 'WBL': case 'ML': case 'AML': case 'KFL': return center - 12;
      case 'DR': case 'WBR': case 'MR': case 'AMR': case 'KFR': return center + 12;
      default: return center;
    }
  }

  function buildRoster(clubId, isUserClub, lineup) {
    let roster = [];

    if (isUserClub && lineup.length > 0) {
      roster = lineup
        .map(id => players[id])
        .filter(p =>
          p &&
          p.clubId === clubId &&
          p.injuryWeeks === 0 &&
          p.suspensionWeeks === 0
        )
        .slice(0, 11);

      if (roster.length < 11) {
        const used = new Set(roster.map(p => p.id));
        const fill = Object.values(players)
          .filter(p =>
            p.clubId === clubId &&
            p.squadRole !== 'u21' &&
            p.injuryWeeks === 0 &&
            p.suspensionWeeks === 0 &&
            !used.has(p.id)
          )
          .sort((a, b) => b.overall - a.overall);

        for (const p of fill) {
          if (roster.length >= 11) break;
          roster.push(p);
        }
      }
      return roster;
    }

    return Object.values(players)
      .filter(p =>
        p.clubId === clubId &&
        p.squadRole !== 'u21' &&
        p.injuryWeeks === 0 &&
        p.suspensionWeeks === 0
      )
      .sort((a, b) => b.overall - a.overall)
      .slice(0, 11);
  }

  function computePositions(roster, isHome) {
    return roster.map((p, i) => {
      const x = isHome
        ? getXOffsetForPosition(p.position)
        : PITCH_LENGTH - getXOffsetForPosition(p.position);
      const y = getYOffsetForPosition(p.position);
      return { idx:i, id:p.id, name:p.name, pos:p.position, squadRole:p.squadRole,
        age:p.age, overall:p.overall, x, y };
    });
  }

  const homeRoster = buildRoster(userClubId, true, userLineup);
  const awayRoster = buildRoster(opponentId, false, []);
  const homePositions = computePositions(homeRoster, true);
  const awayPositions = computePositions(awayRoster, false);

  const ROW_NAMES = ['ST','FORVET','ATAKORTA','ORTA','DEFANSIFORTA','DEFANS','GK'];
  const COL_NAMES = ['SOL','SOLORTA','ORTA','SAGORTA','SAG'];

  const FORMATION_MAPPING = {
    '4-4-2': [
      {row:6,col:2},{row:5,col:0},{row:5,col:1},{row:5,col:3},{row:5,col:4},
      {row:3,col:0},{row:3,col:1},{row:3,col:3},{row:3,col:4},{row:1,col:1},{row:1,col:3}
    ],
    '4-3-3': [
      {row:6,col:2},{row:5,col:0},{row:5,col:1},{row:5,col:3},{row:5,col:4},
      {row:3,col:1},{row:3,col:2},{row:3,col:3},{row:2,col:0},{row:0,col:2},{row:2,col:4}
    ],
    '3-5-2': [
      {row:6,col:2},{row:5,col:1},{row:5,col:2},{row:5,col:3},{row:4,col:0},
      {row:3,col:1},{row:3,col:2},{row:3,col:3},{row:4,col:4},{row:1,col:1},{row:1,col:3}
    ],
    '4-2-3-1': [
      {row:6,col:2},{row:5,col:0},{row:5,col:1},{row:5,col:3},{row:5,col:4},
      {row:4,col:1},{row:4,col:3},{row:2,col:1},{row:2,col:2},{row:2,col:3},{row:0,col:2}
    ]
  };

  const ZONE_SUGGESTED = {
    '6-2':'GK',
    '5-0':'DL','5-1':'DC','5-2':'DC','5-3':'DC','5-4':'DR',
    '4-0':'WBL','4-1':'DMC','4-2':'DMC','4-3':'DMC','4-4':'WBR',
    '3-0':'ML','3-1':'MC','3-2':'MC','3-3':'MC','3-4':'MR',
    '2-0':'AML','2-1':'AMC','2-2':'AMC','2-3':'AMC','2-4':'AMR',
    '1-0':'KFL','1-1':'GF','1-2':'GF','1-3':'GF','1-4':'KFR',
    '0-0':'ST','0-1':'ST','0-2':'ST','0-3':'ST','0-4':'ST'
  };

  const SECONDARY_MAP = {
    GK:[], DC:['DMC'], DL:['WBL','ML'], DR:['WBR','MR'],
    WBL:['DL','ML'], WBR:['DR','MR'], DMC:['MC','DC'],
    ML:['AML','WBL','KFL'], MC:['DMC','AMC'], MR:['AMR','WBR','KFR'],
    AML:['ML','KFL'], AMC:['MC','GF'], AMR:['MR','KFR'],
    KFL:['AML','ML','ST'], GF:['AMC','ST'], KFR:['AMR','MR','ST'],
    ST:['GF','KFL','KFR']
  };

  function zoneToIdealPitch(row, col, isHome) {
    const homeRatio = (6 - row) / 6;
    return {
      x: PITCH_LENGTH * (isHome ? homeRatio : 1 - homeRatio),
      y: PITCH_WIDTH * (col / 4)
    };
  }

  const mapping = FORMATION_MAPPING[userClub.formation] || [];
  let exact=0, secondary=0, mismatch=0;

  console.log('\n' + '='.repeat(110));
  console.log('LIVE POSITION DIAGNOSTIC — v2');
  console.log('Production state DEĞİŞTİRİLMEZ.');
  console.log('='.repeat(110));

  console.log('\n[0] USER LINEUP');
  console.log('userLineup.length:', userLineup.length);
  console.log('userLineup:', userLineup);

  console.log('\n[1] FORMATION');
  console.log('HOME:', userClub.name, userClub.formation);
  console.log('AWAY:', opponent?.name, opponent?.formation);
  console.log('HOME customFormation:', userClub.customFormation ? 'VAR' : 'YOK');
  console.log('AWAY customFormation:', opponent?.customFormation ? 'VAR' : 'YOK');
  if (userClub.formation === 'CUSTOM') {
    const zones = userClub.customFormation?.zones || [];
    console.warn('HOME CUSTOM:', zones.length, 'zone;', zones.filter(z => z.playerId != null).length, 'dolu.');
    console.warn('Production live buildTeamState() custom zonesu formationZonesa taşımıyor.');
  }

  function printRoster(title, positions) {
    console.log('\n[' + title + ']');
    console.table(positions.map(p => ({
      '#':p.idx, id:p.id, name:p.name, pos:p.pos, role:p.squadRole,
      age:p.age, ovr:p.overall, x:p.x, y:p.y
    })));
  }
  printRoster('2 HOME ROSTER + POSITION', homePositions);
  printRoster('3 AWAY ROSTER + POSITION', awayPositions);

  const homeY = [...new Set(homePositions.map(p=>p.y))].sort((a,b)=>a-b);
  const awayY = [...new Set(awayPositions.map(p=>p.y))].sort((a,b)=>a-b);

  console.log('\n[4] Y DAĞILIMI');
  console.log('HOME benzersiz Y:', homeY);
  console.log('AWAY benzersiz Y:', awayY);
  console.log('HOME kullanım:', ((Math.max(...homeY)-Math.min(...homeY))/PITCH_WIDTH*100).toFixed(1)+'%');
  console.log('AWAY kullanım:', ((Math.max(...awayY)-Math.min(...awayY))/PITCH_WIDTH*100).toFixed(1)+'%');

  console.log('\n[5] FORMATION MAPPING');
  if (!mapping.length) console.warn(userClub.formation, 'için mapping yok.');
  else console.table(mapping.map((m,i)=>({
    i, row:m.row, col:m.col, rowName:ROW_NAMES[m.row], colName:COL_NAMES[m.col],
    suggested:ZONE_SUGGESTED[m.row+'-'+m.col] || '?'
  })));

  console.log('\n[6] ZONE ↔ ROSTER (position-aware)');
  const matches = [];
  for (let i=0; i<Math.min(mapping.length,homeRoster.length); i++) {
    const m=mapping[i], p=homeRoster[i];
    const suggested=ZONE_SUGGESTED[m.row+'-'+m.col] || '?';
    let match='uyumsuz';
    if (suggested===p.position) { exact++; match='tam'; }
    else if ((SECONDARY_MAP[suggested]||[]).includes(p.position)) { secondary++; match='secondary'; }
    matches.push({i,zone:ROW_NAMES[m.row]+'/'+COL_NAMES[m.col],suggested,playerPos:p.position,playerId:p.id.slice(-8),match});
  }
  console.table(matches);
  console.log('Tam:',exact,'Secondary:',secondary,'Uyumsuz:',mismatch = Math.min(mapping.length,homeRoster.length)-exact-secondary);
  if (mismatch > 2) console.warn('mapping[i] → roster[i] YANLIŞ. Position-aware assignment gerekir.');
  else if (mismatch+secondary > 2) console.warn('Mapping kısmen uyumlu; kör index eşleştirmesi riskli.');
  else console.log('mapping[i] → roster[i] büyük ölçüde uyumlu.');

  console.log('\n[7] ZONE GEOMETRİSİ vs MEVCUT HOME POSITION');
  if (mapping.length) {
    console.table(mapping.slice(0,homePositions.length).map((m,i)=>{
      const cur=homePositions[i], ideal=zoneToIdealPitch(m.row,m.col,true);
      return {
        i, zone:ROW_NAMES[m.row]+'/'+COL_NAMES[m.col],
        curX:+cur.x.toFixed(1), curY:+cur.y.toFixed(1),
        idealX:+ideal.x.toFixed(1), idealY:+ideal.y.toFixed(1),
        dx:+(cur.x-ideal.x).toFixed(1), dy:+(cur.y-ideal.y).toFixed(1)
      };
    }));
  }

  console.log('\n' + '='.repeat(110));
  console.log('DIAGNOSTIC BİTTİ — çıktının tamamını gönder.');
  console.log('='.repeat(110) + '\n');

  window.__LIVE_POSITION_DIAGNOSTIC_V2__ = {
    userClubId, opponentId, formation:userClub.formation,
    userLineup, homeRoster, awayRoster, homePositions, awayPositions,
    mapping, exact, secondary, mismatch
  };
})();