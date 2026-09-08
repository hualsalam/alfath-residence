#!/usr/bin/perl
# Builds site/ar/index.html from site/index.html + i18n/ar.tsv.
# The Arabic page is generated, never edited by hand: change the English page or the
# translation table, then re-run this script (bash i18n/build-ar.sh).
use strict;
use warnings;
use utf8;               # Arabic literals below are UTF-8
use open ':std', ':encoding(UTF-8)';

my $root = shift or die "usage: build-ar.pl <project root>\n";
my $src  = "$root/site/index.html";
my $tsv  = "$root/i18n/ar.tsv";
my $out  = "$root/site/ar/index.html";

# literal (non-regex) global replace
sub rep {
  my ($s, $from, $to) = @_;
  my $n = 0;
  my $i = 0;
  while (($i = index($s, $from, $i)) >= 0) {
    substr($s, $i, length($from)) = $to;
    $i += length($to);
    $n++;
  }
  return ($s, $n);
}

open(my $fh, '<:encoding(UTF-8)', $src) or die "cannot read $src: $!";
my $html = do { local $/; <$fh> };
close $fh;

# ---- 1. translations from the table ----
open(my $t, '<:encoding(UTF-8)', $tsv) or die "cannot read $tsv: $!";
my (@missing, $applied);
while (my $line = <$t>) {
  chomp $line;
  next if $line =~ /^\s*#/ || $line !~ /\S/;
  my ($from, $to) = split(/\t/, $line, 2);
  next unless defined $to;
  my $n;
  ($html, $n) = rep($html, $from, $to);
  if ($n == 0) { push @missing, $from } else { $applied += $n }
}
close $t;

# ---- 2. structural changes (direction, fonts, paths, metadata) ----
my @structural = (
  ['<html lang="en">', '<html lang="ar" dir="rtl">'],
  # fonts: Amiri for display, Tajawal for UI
  ['<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;1,400&family=Jost:wght@300;400;500;600&display=swap" rel="stylesheet">',
   '<link href="https://fonts.googleapis.com/css2?family=Amiri:ital,wght@0,400;0,700;1,400&family=Tajawal:wght@300;400;500;700&display=swap" rel="stylesheet">'],
  ["'Cormorant Garamond',serif", "'Amiri',serif"],
  ["'Jost',system-ui,sans-serif", "'Tajawal',system-ui,sans-serif"],
  ["'Jost',sans-serif", "'Tajawal',sans-serif"],
  # assets live one level up
  ['"assets/', '"../assets/'],
  ["'assets/", "'../assets/"],
  # canonical / social URLs point at the Arabic page
  ['<link rel="canonical" href="https://alfathresidence.com/">', '<link rel="canonical" href="https://alfathresidence.com/ar/">'],
  ['<meta property="og:url" content="https://alfathresidence.com/">', '<meta property="og:url" content="https://alfathresidence.com/ar/">'],
  ['"url":"https://alfathresidence.com/"', '"url":"https://alfathresidence.com/ar/"'],
  # mirrored inline styles
  ['padding-left:22px;border-left:2px solid #457B9D', 'padding-right:22px;border-right:2px solid #457B9D'],
  ['margin:-20px 0 4px -14px', 'margin:-20px -14px 4px 0'],
  ['padding:26px 16px 12px;text-align:left', 'padding:26px 16px 12px;text-align:right'],
  # language switcher: Arabic page links back to English
  ['<a class="nav__lang" href="/ar/">العربية</a>', '<a class="nav__lang" href="/">English</a>'],
);
for my $pair (@structural) {
  my ($n);
  ($html, $n) = rep($html, $pair->[0], $pair->[1]);
  push @missing, "[structural] $pair->[0]" if $n == 0;
}

# ---- 3. RTL stylesheet, appended so it wins over the shared rules ----
my $rtl = <<'CSS';

  /* ================= Arabic / RTL ================= */
  /* Arabic is cursive: letter-spacing pulls the joined letters apart, so clear it
     everywhere. !important because several spacings are set in inline styles. */
  body *{letter-spacing:normal !important}
  /* elements pinned to a side have to swap sides */
  .hero__mute{right:auto;left:clamp(16px,3vw,40px)}
  .stage__toggle{right:auto;left:16px}
  .stage__hint{left:auto;right:18px}
  .mdl__x{right:auto;left:14px}
  .stat{border-right:0;border-left:1px solid rgba(43,37,33,.08)}
  .stat:last-child{border-left:0}
  .stage__info{border-left:0;border-right:1px solid rgba(220,232,242,.14)}
  @media (max-width:960px){.stage__info{border-right:0;border-top:1px solid rgba(220,232,242,.14)}}
  /* blocks that were explicitly left-aligned */
  .pcard,.mcard,.site,.ct__card,.stage__info,.mdl__body,.mdl__head{text-align:right}
  /* latin/technical values stay left-to-right, aligned to the start edge */
  input[type="email"],input[type="tel"]{direction:ltr;text-align:right}
  .stage__area,.pcard__area,.site em{direction:ltr;display:inline-block}
  /* Leaflet lays out its controls left-to-right; keep the map itself LTR */
  #map,.leaflet-container{direction:ltr}
  .leaflet-popup-content{direction:rtl;text-align:right}
  /* the marquee keeps its original travel direction; captions read right-to-left */
  #gallery-track{direction:ltr}
  #gallery-track span{direction:rtl}
CSS
$html =~ s|</style>|$rtl</style>| or push @missing, '[structural] </style>';

# ---- 4. write ----
mkdir "$root/site/ar" unless -d "$root/site/ar";
open(my $o, '>:encoding(UTF-8)', $out) or die "cannot write $out: $!";
print $o $html;
close $o;

printf("built %s\n  %d replacements applied\n", $out, $applied // 0);
if (@missing) {
  print "  WARNING - these source strings were not found (the English page may have changed):\n";
  print "    - $_\n" for @missing;
  exit 1;
}
print "  all translation keys matched\n";
