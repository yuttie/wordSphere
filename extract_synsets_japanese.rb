#!/usr/bin/env ruby
require 'sqlite3'
require 'json'

data = Hash.new {|h, k| h[k] = { words: [] } }
SQLite3::Database.new("wnjpn.db") {|db|
  db.execute('select synset, def from synset_def where lang = "jpn"') {|synset, gloss|
    data[synset][:gloss] = gloss
  }
  db.execute('select sense.synset, word.lemma from sense, word where sense.lang = "jpn" and word.lang = "jpn" and sense.wordid = word.wordid;') {|synset, lemma|
    data[synset][:words] ||= []
    data[synset][:words] << lemma
  }
}

output = data.values

puts(JSON.generate(output))
