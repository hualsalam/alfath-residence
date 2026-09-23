use strict; use IO::Socket::INET;
# Local preview server for site/. Perl rather than PowerShell: Windows Defender quarantines
# PowerShell HTTP-listener scripts on this machine.
# Port comes from $PORT (set by the Claude preview), else 8797.
use FindBin;
my $root="$FindBin::Bin/site"; my $port=$ENV{PORT}||8797;
my %m=(html=>'text/html; charset=utf-8',js=>'text/javascript',css=>'text/css',png=>'image/png',jpg=>'image/jpeg',svg=>'image/svg+xml',mp4=>'video/mp4',pdf=>'application/pdf',webp=>'image/webp',xml=>'application/xml',txt=>'text/plain');
my $s=IO::Socket::INET->new(LocalAddr=>'127.0.0.1',LocalPort=>$port,Listen=>20,ReuseAddr=>1) or die "listen: $!";
$SIG{PIPE}='IGNORE';
while(my $c=$s->accept){
  my $pid=fork; if(!defined $pid){ close $c; next } if($pid){ close $c; next }
  close $s; binmode $c;
  my $line=<$c>; exit 0 unless $line; my ($meth,$p)=$line=~/^(\w+)\s+(\S+)/; my $range;
  while(my $h=<$c>){ last if $h=~/^\r?\n$/; $range=$1 if $h=~/^Range:\s*bytes=(\S+)/i; }
  $p=~s/\?.*//; $p=~s/%([0-9A-Fa-f]{2})/chr hex $1/ge; $p=~s/\.\.//g; $p.='index.html' if $p=~m{/$};
  my $f="$root$p"; $f.='/index.html' if -d $f;
  unless(-f $f){ print $c "HTTP/1.1 404 Not Found\r\nContent-Length: 0\r\nConnection: close\r\n\r\n"; close $c; exit 0 }
  my ($ext)=$f=~/\.(\w+)$/; my $ct=$m{lc($ext//'')}||'application/octet-stream'; my $len=-s $f;
  open my $fh,'<:raw',$f; my ($st,$en)=(0,$len-1); my $code='200 OK';
  if($range && $range=~/^(\d*)-(\d*)$/){ $st=$1 eq ''?$len-$2:$1; $en=$2 ne '' && $1 ne ''?$2:$len-1; $en=$len-1 if $en>$len-1; $code='206 Partial Content'; }
  my $n=$en-$st+1; print $c "HTTP/1.1 $code\r\nContent-Type: $ct\r\nContent-Length: $n\r\nAccept-Ranges: bytes\r\nCache-Control: no-store\r\n".($code=~/^206/?"Content-Range: bytes $st-$en/$len\r\n":"")."Connection: close\r\n\r\n";
  if($meth ne 'HEAD'){ seek $fh,$st,0; my $left=$n; while($left>0){ my $r=read($fh,my $buf,$left>65536?65536:$left); last unless $r; print $c $buf or last; $left-=$r; } }
  close $fh; close $c; exit 0;
}
