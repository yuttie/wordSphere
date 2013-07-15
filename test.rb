DICT_DIR = './dict'
POS_LIST = [:noun, :verb, :adj, :adv]

IndexEntry = Struct.new(:lemma, :pos, :synset_cnt, :p_cnt, :ptr_symbols, :sense_cnt, :tagsense_cnt, :synset_offsets)
DataEntry = Struct.new(:synset_offset, :lex_filenum, :ss_type, :w_cnt, :word_and_lex_ids, :p_cnt, :ptrs, :frames, :gloss)

index = Hash.new
POS_LIST.map {|pos| "index.#{pos}"}.each {|fn|
  fp = DICT_DIR + '/' + fn
  open(fp, 'r') {|file|
    file.each_line.lazy.drop_while {|l| l =~ /^  / }.each {|l|
      lemma, pos, synset_cnt, p_cnt, *rest = l.chomp.split(/\s/)
      ptr_symbols, rest = rest.take(p_cnt.to_i), rest.drop(p_cnt.to_i)
      sense_cnt, tagsense_cnt, *synset_offsets = rest

      entry = IndexEntry.new(lemma, pos, synset_cnt, p_cnt, ptr_symbols, sense_cnt, tagsense_cnt, synset_offsets)
      index[lemma] = entry
    }
  }
}

data = Hash.new
POS_LIST.map {|pos| "data.#{pos}"}.each {|fn|
  fp = DICT_DIR + '/' + fn
  open(fp, 'r') {|file|
    file.each_line.lazy.drop_while {|l| l =~ /^  / }.each {|l|
      rest, gloss = l.chomp.split(/\s+\|\s+/)
      synset_offset, lex_filenum, ss_type, w_cnt, *rest = rest.split(/\s/)
      word_and_lex_ids, rest = rest.take(2 * w_cnt.to_i(16)).each_slice(2).to_a, rest.drop(2 * w_cnt.to_i(16))
      p_cnt, *rest = rest
      ptrs, *frames = rest.take(4 * p_cnt.to_i).each_slice(4).to_a, rest.drop(4 * p_cnt.to_i)

      entry = DataEntry.new(synset_offset, lex_filenum, ss_type, w_cnt, word_and_lex_ids, p_cnt, ptrs, frames, gloss)
      data[synset_offset] = entry
    }
  }
}
