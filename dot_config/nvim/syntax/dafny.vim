" Vim syntax file for Dafny
" Language: Dafny
" Maintainer: Custom

if exists("b:current_syntax")
  finish
endif

" Keywords
syn keyword dafnyKeyword method function predicate lemma class trait module import export
syn keyword dafnyKeyword var const ghost returns yields
syn keyword dafnyKeyword requires ensures invariant decreases modifies reads
syn keyword dafnyKeyword if then else while for forall exists match case
syn keyword dafnyKeyword return break continue assert assume print
syn keyword dafnyKeyword new this null old fresh allocated unchanged
syn keyword dafnyKeyword datatype codatatype type newtype iterator
syn keyword dafnyKeyword abstract extends refines

" Types
syn keyword dafnyType int nat real bool char string object array seq set multiset map imap
syn keyword dafnyType ORDINAL bv8 bv16 bv32 bv64

" Boolean values
syn keyword dafnyBoolean true false

" Operators
syn match dafnyOperator /==\|!=\|<=\|>=\|<\|>\|&&\|||\|!\|==>\|<==>\|:=\|::\|:|\||\|+\|-\|\*\|\/\|%/

" Numbers
syn match dafnyNumber /\<\d\+\>/
syn match dafnyNumber /\<0x[0-9a-fA-F]\+\>/
syn match dafnyNumber /\<\d\+\.\d*\>/

" Strings
syn region dafnyString start=/"/ skip=/\\"/ end=/"/
syn match dafnyChar /'\\.'\|'[^\\]'/

" Comments
syn match dafnyLineComment "//.*$"
syn region dafnyBlockComment start="/\*" end="\*/"

" Highlighting
hi def link dafnyKeyword Keyword
hi def link dafnyType Type
hi def link dafnyBoolean Boolean
hi def link dafnyOperator Operator
hi def link dafnyNumber Number
hi def link dafnyString String
hi def link dafnyChar Character
hi def link dafnyLineComment Comment
hi def link dafnyBlockComment Comment

let b:current_syntax = "dafny"
