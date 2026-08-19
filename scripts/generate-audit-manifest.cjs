const fs = require('node:fs');
const path = require('node:path');

const args = process.argv.slice(2);
const valueFor = (name) => {
  const index = args.indexOf(name);
  if (index === -1 || !args[index + 1]) throw new Error(`Missing required argument: ${name}`);
  return path.resolve(args[index + 1]);
};

const outputPath = valueFor('--output');
const logPath = valueFor('--log');

const log = (message) => {
  fs.mkdirSync(path.dirname(logPath), { recursive: true });
  fs.appendFileSync(logPath, `${new Date().toISOString()} ${message}\n`, 'utf8');
};

const chapters = [
  ['CH00', 'CH00_C01-03'],
  ['CH01', 'C01_NIELSEN'],
  ['CH02', 'C02_RUNDELL'],
  ['CH03', 'C03_SMITH'],
  ['CH04', 'C04_MOZAFFARI'],
  ['CH05', 'C05_VAINIKKA'],
  ['CH06', 'C06_PALUDAN-MULLER'],
  ['CH07', 'C07_PROZOROVA'],
  ['CH08', 'C08_HANSCAM'],
  ['CH09', 'C09_NORSKOV'],
  ['CH10', 'C10_BOYLE'],
  ['CH11', 'C11_STEELE'],
  ['CH12', 'C12_BAILLIE'],
];

const documentPattern = '^(?!~\\$|desktop\\.ini$).+\\.(docx?|pdf|odt|rtf|txt|md|epub|gdoc|xlsx?|csv)$';
const figurePattern = '^(?!~\\$|desktop\\.ini$).+\\.(png|jpe?g|tiff?|svg|pdf|docx?|xlsx?)$';
const versionPattern = '(?:^|[_\\s-])(?:v|ver|version|rev|revision)[_\\s-]?(\\d+)';

const stages = [
  ['initial_submission', '00_1ST MANUSCRIPT SUBMISSION', documentPattern],
  ['first_feedback', '01_1ST MANUSCRIPT FEEDBACK', documentPattern],
  ['revision_01', '02_REVISION01 SUBMISSION', documentPattern],
  ['internal_peer_review', '03_INTERNAL PEER REVIEW', documentPattern],
  ['first_publisher_submission', '04_FIRST PUBLISHER SUBMISSION', documentPattern],
  ['publisher_review_assessment', '05_PUBLISHER REVIEW ASSESSMENT', documentPattern],
  ['final_manuscript_submission', '06_FINAL MANUSCRUPT SUBMISSION', documentPattern],
  ['figures', '07_FIGURES', figurePattern],
  ['abstract', 'F1_ABSTRACT', documentPattern],
  ['contact_details', 'F2_CONTACT DETAILS', documentPattern],
  ['contract', 'F3_CONTRACT', documentPattern],
  ['permissions', 'F4_PERMISSIONS', documentPattern],
];

try {
  if (fs.existsSync(outputPath)) throw new Error(`Refusing to overwrite existing manifest: ${outputPath}`);

  const manifestStages = chapters.flatMap(([chapterId, chapterDirectory]) =>
    stages.map(([stage, stageDirectory, filenamePattern]) => ({
      chapterId,
      stage,
      directory: `${chapterDirectory}/${chapterId === 'CH01' && stage === 'first_feedback' ? '01_00_1ST MANUSCRIPT FEEDBACK' : stageDirectory}`,
      filenamePattern,
      versionPattern,
    })),
  );

  const manifest = {
    projectId: 'heritage-and-civilisational-analysis',
    stages: manifestStages,
  };

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify(manifest, null, 2)}\n`, { encoding: 'utf8', flag: 'wx' });
  log(`status=complete output=${outputPath} chapters=${chapters.length} stage_types=${stages.length} entries=${manifestStages.length} failures=0`);
  process.stdout.write(JSON.stringify({ outputPath, logPath, chapters: chapters.length, stageTypes: stages.length, entries: manifestStages.length, failures: 0 }));
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  log(`status=failed output=${outputPath} failures=1 error=${JSON.stringify(message)}`);
  process.stderr.write(message);
  process.exitCode = 1;
}
